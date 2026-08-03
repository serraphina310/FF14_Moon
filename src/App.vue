<script setup lang="ts">
import { onMounted, ref } from 'vue'
import TechnicalValidation from './components/TechnicalValidation.vue'
import WorkbenchView from './components/WorkbenchView.vue'
import LegalFooter from './components/LegalFooter.vue'
import { loadWasmProbe } from './wasm'

const isTechnicalValidation = new URLSearchParams(window.location.search).has(
  'technical-validation',
)
const wasmState = ref('正在載入 Rust／WASM…')

onMounted(async () => {
  if (!isTechnicalValidation) return
  try {
    wasmState.value = await loadWasmProbe()
  } catch (error) {
    wasmState.value = `WASM 載入失敗：${String(error)}`
  }
})
</script>

<template>
  <WorkbenchView v-if="!isTechnicalValidation" />
  <main v-else class="validation-page">
    <p class="eyebrow">繁中服 Patch 7.2 技術驗證</p>
    <h1>FF14_Moon</h1>
    <p class="status" data-testid="wasm-status">{{ wasmState }}</p>
    <TechnicalValidation />
    <LegalFooter />
  </main>
</template>
