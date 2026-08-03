<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { APP_NAME } from './app-meta'
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
    <p class="eyebrow">Patch 7.51 技術驗證</p>
    <h1>{{ APP_NAME }}</h1>
    <p class="status" data-testid="wasm-status">{{ wasmState }}</p>
    <p>目前只驗證前端與 Rust／WASM 工具鏈，尚未實作配方搜尋或求解。</p>
  </main>
</template>
