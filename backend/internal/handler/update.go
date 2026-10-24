package handler

import (
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tuzi/cdk-recharge-system/internal/db"
)

// 一键更新状态（进程内；重启后重置为 idle，版本由 VERSION 体现）
type updateState struct {
	Phase      string `json:"phase"` // idle|checking|downloading|verifying|staging|applying|reloading|done|failed
	Message    string `json:"message"`
	Target     string `json:"target,omitempty"`
	Progress   int    `json:"progress"` // 0-100
	Error      string `json:"error,omitempty"`
	StartedAt  string `json:"started_at,omitempty"`
	FinishedAt string `json:"finished_at,omitempty"`
	BytesTotal int64  `json:"bytes_total,omitempty"`
	BytesDone  int64  `json:"bytes_done,omitempty"`
}

var (
	updMu      sync.Mutex
	updRunning bool
	updSnap    = updateState{Phase: "idle", Message: "idle", Progress: 0}
)

func setUpdateState(mut func(*updateState)) {
	updMu.Lock()
	defer updMu.Unlock()
	mut(&updSnap)
}

func getUpdateState() updateState {
	updMu.Lock()
	defer updMu.Unlock()
	return updSnap
}

func updateEnabled() bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv("UPDATE_ENABLED")))
	if v == "0" || v == "false" || v == "no" || v == "off" {
		return false
	}
	// 默认开启；显式 false 才关。开发机可设 UPDATE_ENABLED=0
	return true
}

func installRoot() string {
	if d := strings.TrimSpace(os.Getenv("CDK_INSTALL_DIR")); d != "" {
		return filepath.Clean(d)
	}
	if exe, err := os.Executable(); err == nil {
		if p, err2 := filepath.EvalSymlinks(exe); err2 == nil {
			return filepath.Dir(p)
		}
		return filepath.Dir(exe)
	}
	wd, _ := os.Getwd()
	return wd
}

func webDir() string {
	if d := strings.TrimSpace(os.Getenv("WEB_DIR")); d != "" {
		return filepath.Clean(d)
	}
	return filepath.Join(installRoot(), "web")
}

// AdminSystemUpdateStatus GET /api/v1/admin/system/update/status
func AdminSystemUpdateStatus(c *gin.Context) {
	st := getUpdateState()
	c.JSON(http.StatusOK, gin.H{
		"enabled":    updateEnabled(),
		"running":    st.Phase != "idle" && st.Phase != "done" && st.Phase != "failed",
		"state":      st,
		"current":    resolveLocalVersion(),
		"install":    installRoot(),
		"goos":       runtime.GOOS,
		"goarch":     runtime.GOARCH,
		"can_update": updateEnabled() && runtime.GOOS == "linux",
	})
}

// AdminSystemUpdate POST /api/v1/admin/system/update
// body: { "target": "1.2.0" | "latest", "confirm": true }
// 在线下载 GitHub Release 预编译包 → 校验 → 热替换 web+二进制 → re-exec（亚秒级重载，不碰 app.env/data）
func AdminSystemUpdate(c *gin.Context) {
	if !updateEnabled() {
		c.JSON(http.StatusForbidden, gin.H{"error": "UPDATE_ENABLED=0，未开启一键更新"})
		return
	}
	if runtime.GOOS != "linux" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "一键更新目前仅支持 linux 生产部署"})
		return
	}

	var req struct {
		Target  string `json:"target"`
		Confirm bool   `json:"confirm"`
	}
	_ = c.ShouldBindJSON(&req)
	if !req.Confirm {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请传 confirm=true 确认更新"})
		return
	}
	target := strings.TrimSpace(req.Target)
	if target == "" || strings.EqualFold(target, "latest") {
		target = "latest"
	} else {
		target = strings.TrimPrefix(target, "v")
	}

	updMu.Lock()
	if updRunning {
		updMu.Unlock()
		c.JSON(http.StatusConflict, gin.H{"error": "已有更新在进行中", "state": getUpdateState()})
		return
	}
	updRunning = true
	updSnap = updateState{
		Phase:     "checking",
		Message:   "准备检查 GitHub 发布包…",
		Target:    target,
		Progress:  1,
		StartedAt: time.Now().UTC().Format(time.RFC3339),
	}
	updMu.Unlock()

	u, _ := c.Get("username")
	username, _ := u.(string)
	db.WriteAudit(username, "system_update_start", "target="+target, c.ClientIP())

	// 异步执行：先立即返回，前端轮询 status；完成文件替换后延迟 re-exec
	go runSeamlessUpdate(target, username)

	c.JSON(http.StatusAccepted, gin.H{
		"ok":      true,
		"message": "更新已启动：在线下载与热替换，完成后自动重载（不中断部署配置/数据）",
		"state":   getUpdateState(),
	})
}

func runSeamlessUpdate(target, username string) {
	defer func() {
		if r := recover(); r != nil {
			failUpdate(fmt.Sprintf("panic: %v", r))
		}
		updMu.Lock()
		// reloading 阶段会 re-exec，不在此清 running
		if updSnap.Phase != "reloading" {
			updRunning = false
		}
		updMu.Unlock()
	}()

	setUpdateState(func(s *updateState) {
		s.Phase = "checking"
		s.Message = "查询 GitHub Release…"
		s.Progress = 5
	})

	assetURL, version, shaURL, err := resolveReleaseBundle(target)
	if err != nil {
		failUpdate(err.Error())
		return
	}
	setUpdateState(func(s *updateState) {
		s.Target = version
		s.Message = "找到发布包 v" + version + "，开始下载…"
		s.Progress = 10
	})

	root := installRoot()
	updDir := filepath.Join(root, "updates")
	_ = os.MkdirAll(updDir, 0o755)
	staging := filepath.Join(updDir, "staging-"+version+"-"+fmt.Sprintf("%d", time.Now().Unix()))
	_ = os.RemoveAll(staging)
	if err := os.MkdirAll(staging, 0o755); err != nil {
		failUpdate("创建 staging 失败: " + err.Error())
		return
	}
	defer os.RemoveAll(staging) // 成功 re-exec 前也会清；失败时清理

	tgzPath := filepath.Join(staging, "cdk-bundle.tgz")
	setUpdateState(func(s *updateState) {
		s.Phase = "downloading"
		s.Message = "下载 cdk-bundle…"
		s.Progress = 15
	})
	if err := downloadFile(assetURL, tgzPath, func(done, total int64) {
		setUpdateState(func(s *updateState) {
			s.BytesDone = done
			s.BytesTotal = total
			if total > 0 {
				// 15-55% 给下载
				s.Progress = 15 + int(done*40/total)
			}
			s.Message = fmt.Sprintf("下载中 %s / %s", humanBytes(done), humanBytes(total))
		})
	}); err != nil {
		failUpdate("下载失败: " + err.Error())
		return
	}

	setUpdateState(func(s *updateState) {
		s.Phase = "verifying"
		s.Message = "校验包完整性…"
		s.Progress = 58
	})
	if shaURL == "" {
		failUpdate("缺少 sha256 校验文件，已中止更新（禁止无完整性校验的远程更新）")
		return
	}
	if err := verifySHA256File(tgzPath, shaURL); err != nil {
		failUpdate("sha256 校验失败，已中止更新: " + err.Error())
		return
	}

	setUpdateState(func(s *updateState) {
		s.Phase = "staging"
		s.Message = "解压发布包…"
		s.Progress = 62
	})
	extractDir := filepath.Join(staging, "extract")
	if err := os.MkdirAll(extractDir, 0o755); err != nil {
		failUpdate(err.Error())
		return
	}
	if err := extractTarGz(tgzPath, extractDir); err != nil {
		failUpdate("解压失败: " + err.Error())
		return
	}
	binSrc, webSrc, verSrc, err := locateBundleContents(extractDir)
	if err != nil {
		failUpdate(err.Error())
		return
	}

	setUpdateState(func(s *updateState) {
		s.Phase = "applying"
		s.Message = "热替换前端静态资源…"
		s.Progress = 75
	})
	// 备份
	bak := filepath.Join(updDir, "backup-"+time.Now().Format("20060102-150405"))
	_ = os.MkdirAll(bak, 0o755)
	binDst := filepath.Join(root, "cdk-recharge")
	if exe, err := os.Executable(); err == nil {
		if p, e2 := filepath.EvalSymlinks(exe); e2 == nil {
			binDst = p
		} else {
			binDst = exe
		}
	}
	// 备份旧二进制
	if _, err := os.Stat(binDst); err == nil {
		_ = copyFile(binDst, filepath.Join(bak, "cdk-recharge"))
	}
	// 备份 web
	wd := webDir()
	if st, err := os.Stat(wd); err == nil && st.IsDir() {
		_ = copyDir(wd, filepath.Join(bak, "web"))
	}

	// 热替换 web：先写到 web.next，再原子改名（不删 data/app.env）
	webNext := wd + ".next"
	webPrev := wd + ".prev"
	_ = os.RemoveAll(webNext)
	_ = os.RemoveAll(webPrev)
	if err := copyDir(webSrc, webNext); err != nil {
		failUpdate("写入 web.next 失败: " + err.Error())
		return
	}
	// 轮转：优先原子 rename；Docker overlayfs 的镜像层目录不能跨层 rename，
	// 遇到 EXDEV 时改为先复制带 hash 的静态资源、最后覆盖 index.html。
	if err := activateWebDirectory(wd, webNext, webPrev, os.Rename); err != nil {
		failUpdate("切换 web 失败: " + err.Error())
		return
	}
	_ = os.RemoveAll(webPrev)

	setUpdateState(func(s *updateState) {
		s.Message = "热替换二进制…"
		s.Progress = 88
	})
	// 写 VERSION
	if verSrc != "" {
		_ = copyFile(verSrc, filepath.Join(root, "VERSION"))
	} else {
		_ = os.WriteFile(filepath.Join(root, "VERSION"), []byte(version+"\n"), 0o644)
	}

	// 新二进制写到 .new，chmod，再 rename 覆盖（运行中 inode 仍用旧文件，直到 re-exec）
	binNew := binDst + ".new"
	if err := copyFile(binSrc, binNew); err != nil {
		failUpdate("写入新二进制失败: " + err.Error())
		return
	}
	_ = os.Chmod(binNew, 0o755)
	if err := os.Rename(binNew, binDst); err != nil {
		// 某些 FS 上 rename 覆盖失败时用 copy
		if err2 := copyFile(binNew, binDst); err2 != nil {
			failUpdate("替换二进制失败: " + err.Error() + " / " + err2.Error())
			return
		}
		_ = os.Chmod(binDst, 0o755)
		_ = os.Remove(binNew)
	}

	db.WriteAudit(username, "system_update_applied", "target="+version+" bak="+filepath.Base(bak), "")

	setUpdateState(func(s *updateState) {
		s.Phase = "reloading"
		s.Message = "文件已替换，即将无痕重载进程…"
		s.Progress = 95
		s.FinishedAt = time.Now().UTC().Format(time.RFC3339)
	})

	// 延迟 re-exec，让状态接口还能被读一次
	go func() {
		time.Sleep(400 * time.Millisecond)
		// 优先同进程 re-exec（PID 不变，systemd 无感，亚秒恢复）
		if err := reexecBinary(binDst); err != nil {
			// 回退 systemctl restart
			_ = trySystemctlRestart()
			// 若仍失败，标记 failed（进程若还活着）
			failUpdate("重载失败: " + err.Error() + "（已尝试 systemctl restart）")
		}
	}()
}

func failUpdate(msg string) {
	setUpdateState(func(s *updateState) {
		s.Phase = "failed"
		s.Error = msg
		s.Message = msg
		s.FinishedAt = time.Now().UTC().Format(time.RFC3339)
	})
	updMu.Lock()
	updRunning = false
	updMu.Unlock()
}

func reexecBinary(bin string) error {
	path := bin
	if path == "" {
		var err error
		path, err = os.Executable()
		if err != nil {
			return err
		}
	}
	if p, err := filepath.EvalSymlinks(path); err == nil {
		path = p
	}
	args := os.Args
	if len(args) == 0 {
		args = []string{path}
	} else {
		args[0] = path
	}
	return syscall.Exec(path, args, os.Environ())
}

func trySystemctlRestart() error {
	// 非阻塞：避免卡死在 restart 自己
	cmd := exec.Command("systemctl", "restart", "cdk-recharge")
	return cmd.Start()
}

func resolveReleaseBundle(target string) (assetURL, version, shaURL string, err error) {
	repo := githubRepo()
	client := &http.Client{Timeout: 30 * time.Second}
	var apiURL string
	if target == "latest" {
		apiURL = "https://api.github.com/repos/" + repo + "/releases/latest"
	} else {
		apiURL = "https://api.github.com/repos/" + repo + "/releases/tags/v" + strings.TrimPrefix(target, "v")
	}
	req, _ := http.NewRequest(http.MethodGet, apiURL, nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "cdk-recharge-system-updater")
	if tok := strings.TrimSpace(os.Getenv("GITHUB_TOKEN")); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if resp.StatusCode != 200 {
		msg := string(raw)
		if len(msg) > 200 {
			msg = msg[:200] + "…"
		}
		return "", "", "", fmt.Errorf("GitHub release HTTP %d: %s", resp.StatusCode, msg)
	}
	var rel struct {
		TagName string `json:"tag_name"`
		Assets  []struct {
			Name               string `json:"name"`
			BrowserDownloadURL string `json:"browser_download_url"`
			Size               int64  `json:"size"`
		} `json:"assets"`
	}
	if err := json.Unmarshal(raw, &rel); err != nil {
		return "", "", "", err
	}
	version = strings.TrimPrefix(strings.TrimSpace(rel.TagName), "v")
	if version == "" {
		return "", "", "", fmt.Errorf("release 无 tag_name")
	}

	// 优先架构匹配包
	prefer := []string{
		"cdk-bundle-linux-amd64.tgz",
		"cdk-bundle-linux-x86_64.tgz",
		"cdk-bundle.tgz",
	}
	if runtime.GOARCH == "arm64" {
		prefer = []string{
			"cdk-bundle-linux-arm64.tgz",
			"cdk-bundle-linux-aarch64.tgz",
			"cdk-bundle.tgz",
		}
	}
	var shaCandidates []string
	for _, a := range rel.Assets {
		name := strings.ToLower(a.Name)
		if strings.HasSuffix(name, ".sha256") {
			shaCandidates = append(shaCandidates, a.BrowserDownloadURL)
		}
	}
	for _, want := range prefer {
		for _, a := range rel.Assets {
			if strings.EqualFold(a.Name, want) {
				// 找对应 sha
				for _, a2 := range rel.Assets {
					if strings.EqualFold(a2.Name, want+".sha256") {
						shaURL = a2.BrowserDownloadURL
						break
					}
				}
				if shaURL == "" && len(shaCandidates) == 1 {
					shaURL = shaCandidates[0]
				}
				return a.BrowserDownloadURL, version, shaURL, nil
			}
		}
	}
	// 任意 cdk-bundle*.tgz
	for _, a := range rel.Assets {
		n := strings.ToLower(a.Name)
		if strings.Contains(n, "cdk-bundle") && (strings.HasSuffix(n, ".tgz") || strings.HasSuffix(n, ".tar.gz")) {
			return a.BrowserDownloadURL, version, "", nil
		}
	}
	return "", "", "", fmt.Errorf("Release v%s 未找到预编译包 cdk-bundle-linux-amd64.tgz。请先用 git tag 触发 CI 发布，或手动上传 bundle 到 Release", version)
}

func downloadFile(url, dest string, progress func(done, total int64)) error {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "cdk-recharge-system-updater")
	if tok := strings.TrimSpace(os.Getenv("GITHUB_TOKEN")); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("HTTP %d %s", resp.StatusCode, string(b))
	}
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer f.Close()
	total := resp.ContentLength
	var done int64
	buf := make([]byte, 32*1024)
	for {
		n, er := resp.Body.Read(buf)
		if n > 0 {
			if _, ew := f.Write(buf[:n]); ew != nil {
				return ew
			}
			done += int64(n)
			if progress != nil {
				progress(done, total)
			}
		}
		if er == io.EOF {
			break
		}
		if er != nil {
			return er
		}
	}
	return f.Sync()
}

func verifySHA256File(tgzPath, shaURL string) error {
	req, _ := http.NewRequest(http.MethodGet, shaURL, nil)
	req.Header.Set("User-Agent", "cdk-recharge-system-updater")
	if tok := strings.TrimSpace(os.Getenv("GITHUB_TOKEN")); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("sha HTTP %d", resp.StatusCode)
	}
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	// 格式: <hex>  filename  或纯 hex
	line := strings.TrimSpace(string(raw))
	fields := strings.Fields(line)
	if len(fields) == 0 {
		return fmt.Errorf("empty sha file")
	}
	want := strings.ToLower(fields[0])
	f, err := os.Open(tgzPath)
	if err != nil {
		return err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}
	got := hex.EncodeToString(h.Sum(nil))
	if got != want {
		return fmt.Errorf("sha256 mismatch got=%s want=%s", got, want)
	}
	return nil
}

func extractTarGz(tgzPath, dest string) error {
	f, err := os.Open(tgzPath)
	if err != nil {
		return err
	}
	defer f.Close()
	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		// 防 zip-slip
		name := filepath.Clean(hdr.Name)
		if strings.HasPrefix(name, "..") || filepath.IsAbs(name) {
			return fmt.Errorf("非法路径: %s", hdr.Name)
		}
		target := filepath.Join(dest, name)
		if !strings.HasPrefix(target, filepath.Clean(dest)+string(os.PathSeparator)) && target != filepath.Clean(dest) {
			return fmt.Errorf("非法解压路径: %s", hdr.Name)
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
		case tar.TypeReg, tar.TypeRegA:
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return err
			}
			out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(hdr.Mode)|0o200)
			if err != nil {
				return err
			}
			if _, err := io.Copy(out, tr); err != nil {
				out.Close()
				return err
			}
			out.Close()
		}
	}
	return nil
}

func locateBundleContents(extractDir string) (bin, web, versionFile string, err error) {
	// 允许顶层或单层目录包装
	candidates := []string{extractDir}
	entries, _ := os.ReadDir(extractDir)
	for _, e := range entries {
		if e.IsDir() {
			candidates = append(candidates, filepath.Join(extractDir, e.Name()))
		}
	}
	for _, root := range candidates {
		b := filepath.Join(root, "cdk-recharge")
		w := filepath.Join(root, "web")
		v := filepath.Join(root, "VERSION")
		if st, e := os.Stat(b); e == nil && !st.IsDir() {
			if st2, e2 := os.Stat(w); e2 == nil && st2.IsDir() {
				bin = b
				web = w
				if _, e3 := os.Stat(v); e3 == nil {
					versionFile = v
				}
				return bin, web, versionFile, nil
			}
		}
	}
	return "", "", "", fmt.Errorf("包内缺少 cdk-recharge 二进制或 web/ 目录（请使用 CI 产物 cdk-bundle-linux-amd64.tgz）")
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
	if err != nil {
		return err
	}
	defer out.Close()
	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}

func copyDir(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		if !info.Mode().IsRegular() {
			return nil
		}
		return copyFile(path, target)
	})
}

func activateWebDirectory(current, next, previous string, rename func(string, string) error) error {
	if _, err := os.Stat(current); err == nil {
		if err := rename(current, previous); err != nil {
			if errors.Is(err, syscall.EXDEV) {
				if err := copyDir(current, previous); err != nil {
					return fmt.Errorf("创建 overlayfs 回滚副本失败: %w", err)
				}
				if err := copyWebDirectoryInPlace(next, current); err != nil {
					if restoreErr := copyWebDirectoryInPlace(previous, current); restoreErr != nil {
						return fmt.Errorf("overlayfs 兼容复制失败: %v；恢复旧 web 失败: %w", err, restoreErr)
					}
					return fmt.Errorf("overlayfs 兼容复制失败，已恢复旧 web: %w", err)
				}
				_ = os.RemoveAll(next)
				return nil
			}
			return err
		}
	} else if !os.IsNotExist(err) {
		return err
	}

	if err := rename(next, current); err != nil {
		if rollbackErr := rename(previous, current); rollbackErr != nil {
			if copyErr := copyDir(previous, current); copyErr != nil {
				return fmt.Errorf("启用新 web 失败: %v；rename 回滚失败: %v；复制恢复失败: %w", err, rollbackErr, copyErr)
			}
			return fmt.Errorf("启用新 web 失败: %v；rename 回滚失败，已复制恢复旧 web: %w", err, rollbackErr)
		}
		return fmt.Errorf("启用新 web 失败: %w", err)
	}
	return nil
}

func copyWebDirectoryInPlace(src, dst string) error {
	indexSrc := filepath.Join(src, "index.html")
	if st, err := os.Stat(indexSrc); err != nil || st.IsDir() {
		if err != nil {
			return fmt.Errorf("读取 index.html: %w", err)
		}
		return fmt.Errorf("index.html 不是普通文件")
	}

	if err := filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		if rel == "index.html" {
			return nil
		}
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		if !info.Mode().IsRegular() {
			return nil
		}
		return copyFileAtomic(path, target)
	}); err != nil {
		return err
	}

	return copyFileAtomic(indexSrc, filepath.Join(dst, "index.html"))
}

func copyFileAtomic(src, dst string) (retErr error) {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(dst), ".web-update-*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer func() {
		_ = tmp.Close()
		if retErr != nil {
			_ = os.Remove(tmpPath)
		}
	}()

	if err := tmp.Chmod(0o755); err != nil {
		return err
	}
	if _, err := io.Copy(tmp, in); err != nil {
		return err
	}
	if err := tmp.Sync(); err != nil {
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpPath, dst); err != nil {
		return err
	}
	return nil
}

func humanBytes(n int64) string {
	if n <= 0 {
		return "—"
	}
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for v := n / unit; v >= unit; v /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(n)/float64(div), "KMGTPE"[exp])
}
