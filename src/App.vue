<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { APP_NAME } from './app-meta'
import TechnicalValidation from './components/TechnicalValidation.vue'
import { loadWasmProbe } from './wasm'

const wasmState = ref('正在載入 Rust／WASM…')

onMounted(async () => {
  try {
    wasmState.value = await loadWasmProbe()
  } catch (error) {
    wasmState.value = `WASM 載入失敗：${String(error)}`
  }
})
</script>

<template>
  <main>
    <p class="eyebrow">繁中服 Patch 7.2 技術驗證</p>
    <h1>{{ APP_NAME }}</h1>
    <p class="status" data-testid="wasm-status">{{ wasmState }}</p>
    <p>以下是完整工作台 UI 之前的硬性技術驗證，不會連線到原始 BestCraft 網站。</p>
    <TechnicalValidation />
  </main>
</template>
