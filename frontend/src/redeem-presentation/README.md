# 兑换页展示层（东方意象七主题）

## 来源与授权

本目录移植自朋友的 autocard 项目（`autocard-ux-polish-20261115`，前端 `frontend/src`）的「兑换展示层」：
七个东方意象主题（天阙云殿 / 流霞天绫 / 月魄玉璧 / 星宿天衡 / 辰海天河 / 青玉山海 / 曦羽流霞）
的照片底板、环境画布、双栏玻璃卡布局、卡片材质与每个主题的文案。

**原作者已于 2026-11-17 明确授权以开源方式复用全部这些代码与素材。**
`frontend/public/redeem-plates/*.webp`（14 张主题底板照片）同源同授权。

## 目录

| 路径 | 内容 | 是否改动 |
| --- | --- | --- |
| `components/RedeemPresentation.vue` | 外壳：底板照片、画布、顶栏、双栏、页脚、弹层 | 少量接入改动（见下） |
| `components/RedeemThemeIdentity.vue` `ModalDialog.vue` `ThemeToggle.vue` | 原样 | 否 |
| `components/RedeemTutorial.vue` | 图文教程弹层 | 隐藏视频/截图/音乐入口；提示优先取本站内容 |
| `components/LanguageToggle.vue` | 语言菜单 | 只保留 zh / en（本站无俄文） |
| `visuals/redeem/**` `visuals/product-identity/**` `assets/redeem/*.webp` | 卡片运行时、样式、场景/印章 SVG、纹理 | 两处 CSS 全局规则加了 `[data-family=mythic]` 限定 |
| `utils/*` `lib/plans.ts` | 原样（`publicPresentation.ts` 除外） | — |
| `utils/publicPresentation.ts` | **本站重写的适配版**：不请求外观接口，主题跟随本站皮肤 | 是 |
| `presets/default-content.json` | 原项目后端默认外观内容 | 否 |
| `presets/products/*.json` `presets/chapters.json` | 原项目后端套餐清单、教程章节 | 否（只改了引用路径） |
| `i18n/m19.ts` | 原样 | 否 |
| `theme.ts` `i18n/index.ts` | 本站适配：转接到 `src/theme.ts`、`src/i18n` | 新增 |
| `i18n/messages.ts` `content.ts` `adapter.ts` `config.ts` `shell-state.ts` `styles/host-overrides.css` | 本站接入层 | 新增 |

## 怎么接上的

- **主题**：本站皮肤 `currentSkinMeta.family === 'mythic'` 时，展示主题 = 皮肤 id（`atelier`…`dawn`），换肤实时生效。
- **明暗**：完全跟随本站 `src/theme.ts`（`isDark()` / `themeMode`）；展示层不再按内容默认值改明暗。
- **内容**：随包的 `presets/default-content.json`，由 `content.ts` 覆盖：品牌字样换成本站品牌、导航换成本站路由、
  图文教程改写成本站流程、英文界面换英文标题与按钮。不新增后端端点，不发外观请求。
- **兑换页**：`src/views/user/RechargeView.vue` 在东方意象皮肤下渲染进 `<RedeemPresentation surface="recharge">`，
  表单作为默认 slot，沿用原项目的表单类名（`cdk-entry` / `account-entry` / `review-entry` / `task-observation`）以复用其样式；
  其它皮肤下仍是原来的经典版，代码未动。状态映射见 `adapter.ts`。
- **其它用户页**（同样只在东方意象皮肤下进外壳，其它皮肤不变）：
  - `/batch`（BatchRedeemView）：`surface="recharge" mode="batch"`，对应原项目兑换页的批量模式；外层用动态组件切换外壳 / 原 `div.u-page`，
    输入阶段沿用原项目批量表单类名（`ru-has-tools` / `ru-batch-bar` / `work-primary`），运行阶段沿用本站结构。
  - `/history`（CDKStatusView）：`surface="history"`，对应原项目 HistoryView 的查询页（`query-tabs` / `query-result` / `query-facts`）。
  - `/billing`（BillingCheckView）：`surface="billing"`，对应原项目订阅查询页（`billing-mode-switch.query-tabs` / `billing-result-*` / `rf-more`）。
  - 卡面阶段与状态文字的映射见 `adapter.ts` 的 `queryCard` / `batchPhase`。
- **背景**：外壳在时，App 级的 `MythicBackdrop` 画布让位（`shell-state.ts` 计数），避免双背景。

## 降级（未随包分发的媒体）

原项目 `public/media`（约 36 MB：教学视频、背景音乐、教程截图）没有带过来，对应入口隐藏，开关见 `config.ts`：
页脚「教学视频」「音乐播放」、「显示与声音」里的音量、教程里的「观看这一节」与示例截图。其余展示不受影响。
