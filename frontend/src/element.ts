// Element Plus 按需注册：只注册实际用到的组件、指令与图标。
//
// 原来 app.use(ElementPlus) + 全量 index.css + 300 多个图标全局注册，
// 主包 1.28 MB（gzip 415 kB）、CSS 401 kB，首屏全部要下载解析。
// 新增组件时在这里补一行（组件 + 样式），模板里用到却没注册会在控制台报 Failed to resolve component。
import type { App } from 'vue'
// ★必须按组件目录深路径导入，不能 from 'element-plus'★：每个组件模块顶层都调用 withInstall()
// 且没有 PURE 标注，打包器只要碰到总入口就无法摇树，会把 145 个组件全部打进来（实测 926 kB）。
import { ElAlert } from 'element-plus/es/components/alert/index.mjs'
import { ElButton, ElButtonGroup } from 'element-plus/es/components/button/index.mjs'
import { ElCard } from 'element-plus/es/components/card/index.mjs'
import { ElCheckbox } from 'element-plus/es/components/checkbox/index.mjs'
import { ElConfigProvider } from 'element-plus/es/components/config-provider/index.mjs'
import { ElDescriptions, ElDescriptionsItem } from 'element-plus/es/components/descriptions/index.mjs'
import { ElDialog } from 'element-plus/es/components/dialog/index.mjs'
import { ElDrawer } from 'element-plus/es/components/drawer/index.mjs'
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus/es/components/dropdown/index.mjs'
import { ElEmpty } from 'element-plus/es/components/empty/index.mjs'
import { ElForm, ElFormItem } from 'element-plus/es/components/form/index.mjs'
import { ElIcon } from 'element-plus/es/components/icon/index.mjs'
import { ElInput } from 'element-plus/es/components/input/index.mjs'
import { ElInputNumber } from 'element-plus/es/components/input-number/index.mjs'
import { ElOption, ElSelect } from 'element-plus/es/components/select/index.mjs'
import { ElPagination } from 'element-plus/es/components/pagination/index.mjs'
import { ElPopover } from 'element-plus/es/components/popover/index.mjs'
import { ElRadioButton, ElRadioGroup } from 'element-plus/es/components/radio/index.mjs'
import { ElResult } from 'element-plus/es/components/result/index.mjs'
import { ElSwitch } from 'element-plus/es/components/switch/index.mjs'
import { ElTable, ElTableColumn } from 'element-plus/es/components/table/index.mjs'
import { ElTag } from 'element-plus/es/components/tag/index.mjs'
import { vLoading } from 'element-plus/es/components/loading/index.mjs'
import {
  ArrowDown, Bell, Brush, CreditCard, Document, Key, Link, List, Odometer,
} from '@element-plus/icons-vue'

import 'element-plus/theme-chalk/base.css'
import 'element-plus/theme-chalk/el-alert.css'
import 'element-plus/theme-chalk/el-button.css'
import 'element-plus/theme-chalk/el-button-group.css'
import 'element-plus/theme-chalk/el-card.css'
import 'element-plus/theme-chalk/el-checkbox.css'
import 'element-plus/theme-chalk/el-descriptions.css'
import 'element-plus/theme-chalk/el-descriptions-item.css'
import 'element-plus/theme-chalk/el-dialog.css'
import 'element-plus/theme-chalk/el-drawer.css'
import 'element-plus/theme-chalk/el-dropdown.css'
import 'element-plus/theme-chalk/el-dropdown-item.css'
import 'element-plus/theme-chalk/el-dropdown-menu.css'
import 'element-plus/theme-chalk/el-empty.css'
import 'element-plus/theme-chalk/el-form.css'
import 'element-plus/theme-chalk/el-form-item.css'
import 'element-plus/theme-chalk/el-icon.css'
import 'element-plus/theme-chalk/el-input.css'
import 'element-plus/theme-chalk/el-input-number.css'
import 'element-plus/theme-chalk/el-loading.css'
import 'element-plus/theme-chalk/el-option.css'
import 'element-plus/theme-chalk/el-overlay.css'
import 'element-plus/theme-chalk/el-pagination.css'
import 'element-plus/theme-chalk/el-popover.css'
import 'element-plus/theme-chalk/el-popper.css'
import 'element-plus/theme-chalk/el-radio-button.css'
import 'element-plus/theme-chalk/el-radio-group.css'
import 'element-plus/theme-chalk/el-result.css'
import 'element-plus/theme-chalk/el-scrollbar.css'
import 'element-plus/theme-chalk/el-select.css'
import 'element-plus/theme-chalk/el-select-dropdown.css'
import 'element-plus/theme-chalk/el-switch.css'
import 'element-plus/theme-chalk/el-table.css'
import 'element-plus/theme-chalk/el-table-column.css'
import 'element-plus/theme-chalk/el-tag.css'
import 'element-plus/theme-chalk/el-tooltip.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

const components = [
  ElAlert, ElButton, ElButtonGroup, ElCard, ElCheckbox, ElConfigProvider, ElDescriptions, ElDescriptionsItem,
  ElDialog, ElDrawer, ElDropdown, ElDropdownItem, ElDropdownMenu, ElEmpty, ElForm, ElFormItem,
  ElIcon, ElInput, ElInputNumber, ElOption, ElPagination, ElPopover, ElRadioButton, ElRadioGroup,
  ElResult, ElSelect, ElSwitch, ElTable, ElTableColumn, ElTag,
]

// 管理端导航按名字引用图标（<component :is="'Odometer'" />），所以按原名全局注册。
const icons = { ArrowDown, Bell, Brush, CreditCard, Document, Key, Link, List, Odometer }

export function installElement(app: App) {
  // 用 app.component 按名注册，不用 app.use：子组件（ElRadioGroup/ElTableColumn/ElDropdownItem…）
  // 的 install 是空操作，只有父组件 install 时才连带注册，单独 use 会漏掉（dev 下报 Failed to resolve）。
  for (const c of components) app.component((c as { name: string }).name, c)
  app.directive('loading', vLoading)
  for (const [name, comp] of Object.entries(icons)) app.component(name, comp)
}
