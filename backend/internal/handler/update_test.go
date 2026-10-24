package handler

import (
	"errors"
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

func TestActivateWebDirectoryFallsBackOnCrossDeviceRename(t *testing.T) {
	root := t.TempDir()
	current := filepath.Join(root, "web")
	next := filepath.Join(root, "web.next")
	previous := filepath.Join(root, "web.prev")

	writeTestFile(t, filepath.Join(current, "index.html"), "old index")
	writeTestFile(t, filepath.Join(current, "assets", "old.js"), "old asset")
	writeTestFile(t, filepath.Join(next, "assets", "new.js"), "new asset")
	writeTestFile(t, filepath.Join(next, "index.html"), "new index")

	rename := func(oldPath, newPath string) error {
		if oldPath == current && newPath == previous {
			return &os.LinkError{Op: "rename", Old: oldPath, New: newPath, Err: syscall.EXDEV}
		}
		return errors.New("unexpected rename")
	}

	if err := activateWebDirectory(current, next, previous, rename); err != nil {
		t.Fatalf("activateWebDirectory() error = %v", err)
	}

	assertTestFile(t, filepath.Join(current, "index.html"), "new index")
	assertTestFile(t, filepath.Join(current, "assets", "new.js"), "new asset")
	assertTestFile(t, filepath.Join(current, "assets", "old.js"), "old asset")
	if _, err := os.Stat(next); !os.IsNotExist(err) {
		t.Fatalf("web.next should be removed after fallback, stat error = %v", err)
	}
}

func TestActivateWebDirectoryUsesRenameOnSameFilesystem(t *testing.T) {
	root := t.TempDir()
	current := filepath.Join(root, "web")
	next := filepath.Join(root, "web.next")
	previous := filepath.Join(root, "web.prev")

	writeTestFile(t, filepath.Join(current, "index.html"), "old index")
	writeTestFile(t, filepath.Join(next, "index.html"), "new index")

	if err := activateWebDirectory(current, next, previous, os.Rename); err != nil {
		t.Fatalf("activateWebDirectory() error = %v", err)
	}

	assertTestFile(t, filepath.Join(current, "index.html"), "new index")
	assertTestFile(t, filepath.Join(previous, "index.html"), "old index")
}

func TestActivateWebDirectoryRestoresCurrentWhenFallbackCopyFails(t *testing.T) {
	root := t.TempDir()
	current := filepath.Join(root, "web")
	next := filepath.Join(root, "web.next")
	previous := filepath.Join(root, "web.prev")

	writeTestFile(t, filepath.Join(current, "a-config.json"), "old config")
	writeTestFile(t, filepath.Join(current, "assets"), "blocks destination directory")
	writeTestFile(t, filepath.Join(current, "index.html"), "old index")
	writeTestFile(t, filepath.Join(next, "a-config.json"), "new config")
	writeTestFile(t, filepath.Join(next, "assets", "new.js"), "new asset")
	writeTestFile(t, filepath.Join(next, "index.html"), "new index")

	rename := func(oldPath, newPath string) error {
		if oldPath == current && newPath == previous {
			return &os.LinkError{Op: "rename", Old: oldPath, New: newPath, Err: syscall.EXDEV}
		}
		return errors.New("unexpected rename")
	}

	if err := activateWebDirectory(current, next, previous, rename); err == nil {
		t.Fatal("activateWebDirectory() error = nil, want fallback copy failure")
	}

	assertTestFile(t, filepath.Join(current, "a-config.json"), "old config")
	assertTestFile(t, filepath.Join(current, "assets"), "blocks destination directory")
	assertTestFile(t, filepath.Join(current, "index.html"), "old index")
	assertTestFile(t, filepath.Join(previous, "index.html"), "old index")
}

func TestActivateWebDirectoryRollsBackWhenSecondRenameFails(t *testing.T) {
	root := t.TempDir()
	current := filepath.Join(root, "web")
	next := filepath.Join(root, "web.next")
	previous := filepath.Join(root, "web.prev")

	writeTestFile(t, filepath.Join(current, "index.html"), "old index")
	writeTestFile(t, filepath.Join(next, "index.html"), "new index")

	renameCalls := 0
	rename := func(oldPath, newPath string) error {
		renameCalls++
		if renameCalls == 2 {
			return errors.New("injected activation failure")
		}
		return os.Rename(oldPath, newPath)
	}

	if err := activateWebDirectory(current, next, previous, rename); err == nil {
		t.Fatal("activateWebDirectory() error = nil, want activation failure")
	}
	assertTestFile(t, filepath.Join(current, "index.html"), "old index")
}

func TestActivateWebDirectoryCopiesPreviousWhenRenameRollbackFails(t *testing.T) {
	root := t.TempDir()
	current := filepath.Join(root, "web")
	next := filepath.Join(root, "web.next")
	previous := filepath.Join(root, "web.prev")

	writeTestFile(t, filepath.Join(current, "index.html"), "old index")
	writeTestFile(t, filepath.Join(next, "index.html"), "new index")

	renameCalls := 0
	rename := func(oldPath, newPath string) error {
		renameCalls++
		if renameCalls >= 2 {
			return errors.New("injected rename failure")
		}
		return os.Rename(oldPath, newPath)
	}

	if err := activateWebDirectory(current, next, previous, rename); err == nil {
		t.Fatal("activateWebDirectory() error = nil, want activation failure")
	}
	assertTestFile(t, filepath.Join(current, "index.html"), "old index")
}

func writeTestFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func assertTestFile(t *testing.T, path, want string) {
	t.Helper()
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != want {
		t.Fatalf("%s = %q, want %q", path, got, want)
	}
}
