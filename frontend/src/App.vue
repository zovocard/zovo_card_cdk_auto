<template>
  <div id="app" class="min-h-screen">
    <MythicBackdrop />
    <router-view />
    <DialogHost />
  </div>
</template>

<script setup lang="ts">
import DialogHost from './components/DialogHost.vue'
import MythicBackdrop from './components/MythicBackdrop.vue'
</script>
