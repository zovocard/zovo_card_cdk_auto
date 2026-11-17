// 极小的共享状态，单独成文件：App 级 MythicBackdrop 引用它时不把整套展示层拉进首屏包。
import { ref } from 'vue'

/** 已挂载的展示外壳数量；>0 时 App 级的 MythicBackdrop 让位（外壳自带环境画布，避免双背景）。 */
export const presentationShells = ref(0)
