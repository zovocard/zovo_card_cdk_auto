<template>
  <header class="adm-head">
    <div class="adm-head__text">
      <h1 class="adm-head__title">{{ title }}</h1>
      <p v-if="desc || $slots.desc" class="adm-head__desc"><slot name="desc">{{ desc }}</slot></p>
    </div>
    <div v-if="$slots.default || $slots.more" class="adm-head__actions">
      <slot />
      <el-dropdown v-if="$slots.more" :persistent="false" trigger="click" placement="bottom-end" @command="(c: string) => emit('more', c)">
        <el-button aria-label="更多操作">更多<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
        <template #dropdown>
          <el-dropdown-menu><slot name="more" /></el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<script setup lang="ts">
// 后台统一页头：标题 + 一行说明 + 右上角一个主操作，其余次要操作收进「更多」。
defineProps<{ title: string; desc?: string }>()
const emit = defineEmits<{ (e: 'more', command: string): void }>()
</script>
