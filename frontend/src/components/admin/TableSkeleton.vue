<template>
  <div class="tbl-sk" :style="{ '--sk-row': `${rowHeight}px` }" aria-busy="true" aria-label="加载中">
    <div class="tbl-sk__head">
      <span v-for="(w, i) in cols" :key="i" class="sk" :style="{ flex: w }" />
    </div>
    <div v-for="r in rows" :key="r" class="tbl-sk__row">
      <span v-for="(w, i) in cols" :key="i" class="sk" :style="{ flex: w, maxWidth: i === 0 ? '24px' : undefined, opacity: 1 - r * 0.03 }" />
    </div>
  </div>
</template>

<script setup lang="ts">
// 首次加载的表格骨架：行高、行数与真实表格一致，数据到了直接替换，不发生位移。
withDefaults(defineProps<{ rows?: number; cols?: number[]; rowHeight?: number }>(), {
  rows: 10,
  cols: () => [0.4, 1, 3, 1, 1, 1, 1.5, 1.6, 1.2],
  rowHeight: 40,
})
</script>
