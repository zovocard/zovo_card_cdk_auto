# 东方意象七主题（mythic）

天阙云殿 `atelier` · 流霞天绫 `silk` · 月魄玉璧 `porcelain` · 星宿天衡 `orbit` · 辰海天河 `astral` · 青玉山海 `verdant` · 曦羽流霞 `dawn`

**来源**：移植自朋友的 autocard 项目（场景版画、印章、调色板、canvas 背景氛围），原作者已授权在本项目中开源使用（2026-11-17）。

| 文件 | 作用 |
|---|---|
| `palettes.mjs` | 七主题日/夜底色、主色、光晕——**唯一色值来源** |
| `../../../scripts/gen-mythic-skins.mjs` | 由调色板生成 `styles/mythic-skins.css`（改色后重跑 `node scripts/gen-mythic-skins.mjs`） |
| `../../styles/mythic-personality.css` | 七主题共用性格（胶囊按钮、半透明磨砂面板、下划线页签、印章 logo、标题区场景版画） |
| `atmosphere.js` | canvas 背景氛围（蚀刻线、雾气、星尘），由 `components/MythicBackdrop.vue` 驱动 |
| `scenes/*.svg` `seals/*.svg` | 场景版画与印章，`currentColor` 线描，用作 CSS mask 跟主题主色 |

背景动画约 24fps、标签页隐藏时暂停；系统开启「减少动态效果」时只画一帧静态图。单帧绘制约 0.3–0.5ms（1440×900@2x）。
新增主题：在 `palettes.mjs` 加一项 + `scenes/`、`seals/` 放图 + `theme.ts` 的 `SKINS` 加一项（`family: 'mythic'`）+ 后端 `allowedSkins` 白名单 + `mythic-personality.css` 末尾加 `--mythic-seal/--mythic-scene`，再跑生成脚本。
