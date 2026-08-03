<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import {
  calculateRecipeValues,
  loadRecipeData,
  resolveRecipeLevel,
  searchRecipes,
  type RecipeRecord,
} from '../data/recipes'
import { formatMacro, type FormattedMacro } from '../macro/format'
import { createSolveRequest } from '../solver/request'
import type { SolveResponse, SolverFailure } from '../solver/types'
import { SolverWorkerClient } from '../solver/worker-client'

const PLAYER_LEVEL = 79
const WHEEL_RECIPE_ID = 36173
const SAP_RECIPE_ID = 36178

const client = new SolverWorkerClient()
const phase = ref<'idle' | 'loading' | 'solving' | 'success' | 'failure'>('idle')
const status = ref('尚未執行')
const recipe = ref<RecipeRecord>()
const recipeLevelId = ref<number>()
const result = ref<SolveResponse>()
const macro = ref<FormattedMacro>()
const failure = ref<SolverFailure>()

async function runValidation(): Promise<void> {
  phase.value = 'loading'
  status.value = '正在從本站載入繁中 7.2 配方資料…'
  result.value = undefined
  macro.value = undefined
  failure.value = undefined

  try {
    const data = await loadRecipeData()
    const matches = searchRecipes(data.recipes, 'carpenter', '宇宙探索用的紡車')
    const selectedRecipe = matches.find((candidate) => candidate.id === WHEEL_RECIPE_ID)
    if (selectedRecipe === undefined) throw new Error('本機繁中資料找不到配方 36173。')

    const resolved = resolveRecipeLevel(
      selectedRecipe,
      PLAYER_LEVEL,
      data.recipeLevels,
      data.dynamic,
    )
    if (!resolved.isDynamic) throw new Error('配方 36173 未被判定為動態配方。')

    const sap = data.recipes.find((candidate) => candidate.id === SAP_RECIPE_ID)
    if (sap === undefined) throw new Error('本機繁中資料找不到配方 36178。')
    const sapResolved = resolveRecipeLevel(sap, PLAYER_LEVEL, data.recipeLevels, data.dynamic)
    const sapValues = calculateRecipeValues(sap, sapResolved.recipeLevel)
    if (
      sapValues.difficulty !== 1060 ||
      sapValues.quality !== 2250 ||
      sapValues.durability !== 40
    ) {
      throw new Error('配方 36178 未重現遊戲畫面的 1060／2250／40。')
    }

    recipe.value = selectedRecipe
    recipeLevelId.value = resolved.recipeLevel.id
    phase.value = 'solving'
    status.value = '正在 Worker 中執行 Raphael，完成後會再以同版本模擬器驗證…'

    const solveResult = await client.solve(
      createSolveRequest(
        { level: PLAYER_LEVEL, craftsmanship: 1555, control: 1534, craftPoints: 421 },
        selectedRecipe,
        resolved.recipeLevel,
        0,
        {
          useManipulation: true,
          useHeartAndSoul: false,
          useQuickInnovation: false,
          useTrainedEye: false,
          backloadProgress: false,
          adversarial: true,
        },
      ),
    )

    if (!solveResult.ok) {
      failure.value = solveResult.error
      phase.value = 'failure'
      status.value = solveResult.error.message
      return
    }

    if (!solveResult.value.simulation.verified) {
      throw new Error('Worker 回傳的技能序列未通過同版本模擬器驗證。')
    }
    result.value = solveResult.value
    macro.value = formatMacro(solveResult.value.actions)
    phase.value = 'success'
    status.value = '技術驗證通過'
  } catch (error) {
    phase.value = 'failure'
    status.value = error instanceof Error ? error.message : String(error)
  }
}

function cancelValidation(): void {
  client.cancel()
}

onBeforeUnmount(() => client.dispose())
</script>

<template>
  <section class="validation" aria-labelledby="validation-title">
    <div>
      <p class="section-label">Phase 4 技術閘門</p>
      <h2 id="validation-title">宇宙探索用的紡車</h2>
      <p>以木工師 Lv.79、作業精度 1555、加工精度 1534、CP 421 驗證本機完整流程。</p>
    </div>

    <div class="actions">
      <button :disabled="phase === 'loading' || phase === 'solving'" @click="runValidation">
        執行技術驗證
      </button>
      <button v-if="phase === 'solving'" class="secondary" @click="cancelValidation">取消</button>
    </div>

    <p class="validation-status" :data-state="phase" data-testid="validation-status">
      {{ status }}
    </p>

    <dl v-if="recipe && recipeLevelId" class="facts">
      <div><dt>本機配方</dt><dd>{{ recipe.name }}（ID {{ recipe.id }}）</dd></div>
      <div><dt>判定</dt><dd>動態普通配方</dd></div>
      <div><dt>玩家等級</dt><dd>Lv.79</dd></div>
      <div><dt>稽核用 RecipeLevel</dt><dd>{{ recipeLevelId }}</dd></div>
    </dl>

    <template v-if="result && macro">
      <dl class="facts result-facts">
        <div><dt>模擬驗證</dt><dd>{{ result.simulation.verified ? '通過' : '失敗' }}</dd></div>
        <div><dt>進展</dt><dd>{{ result.simulation.finalStatus.progress }}／1197</dd></div>
        <div><dt>品質</dt><dd>{{ result.simulation.finalStatus.quality }}／2790</dd></div>
        <div><dt>剩餘耐久</dt><dd>{{ result.simulation.finalStatus.durability }}</dd></div>
        <div><dt>剩餘 CP</dt><dd>{{ result.simulation.finalStatus.craftPoints }}</dd></div>
        <div><dt>巨集</dt><dd>{{ macro.totalSteps }} 步／{{ macro.estimatedSeconds }} 秒</dd></div>
      </dl>

      <details data-testid="macro-sections">
        <summary>查看繁中巨集（{{ macro.sections.length }} 段）</summary>
        <article v-for="section in macro.sections" :key="section.index" class="macro-section">
          <h3>巨集 #{{ section.index }}</h3>
          <pre>{{ section.text }}</pre>
        </article>
      </details>
    </template>

    <p v-if="failure?.detail" class="failure-detail">技術細節：{{ failure.detail }}</p>
  </section>
</template>
