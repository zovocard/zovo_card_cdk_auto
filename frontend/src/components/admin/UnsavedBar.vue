<template>
  <transition name="unsaved">
    <div v-if="show" class="unsaved-bar" role="region" aria-label="未保存的更改">
      <span class="unsaved-bar__dot" aria-hidden="true" />
      <span class="unsaved-bar__text">未保存更改<template v-if="detail"> · {{ detail }}</template></span>
      <el-button :disabled="saving" @click="emit('discard')">放弃</el-button>
      <el-button type="primary" :loading="saving" @click="emit('save')">保存</el-button>
    </div>
  </transition>
</template>

<script setup lang="ts">
// 有保存按钮的设置页：出现未保存修改时，底部吸附一条「未保存更改 · 放弃 / 保存」。
defineProps<{ show: boolean; saving?: boolean; detail?: string }>()
const emit = defineEmits<{ (e: 'discard'): void; (e: 'save'): void }>()
</script>
