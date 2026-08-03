<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  calculateRecipeValues,
  loadRecipeData,
  resolveRecipeLevel,
  searchRecipes,
  type CraftJob,
  type RecipeData,
  type RecipeRecord,
} from '../data/recipes'
import {
  buildSolutionFingerprint,
  createSolutionSnapshot,
  isSolutionStale,
  type AttributeProfile,
  type AttributeProfileInput,
} from '../domain/workbench'
import { ZH_TW_ACTION_NAMES } from '../macro/actions'
import { formatMacro } from '../macro/format'
import { createSolveRequest } from '../solver/request'
import { SolverWorkerClient } from '../solver/worker-client'
import type { SolverFailure, SolverOptions } from '../solver/types'
import { useWorkbenchStore } from '../stores/workbench'
import LegalFooter from './LegalFooter.vue'

const JOBS: ReadonlyArray<{ id: CraftJob; name: string; short: string }> = [
  { id: 'carpenter', name: '木工師', short: '木工' },
  { id: 'blacksmith', name: '鍛鐵匠', short: '鍛鐵' },
  { id: 'armorer', name: '甲冑師', short: '甲冑' },
  { id: 'goldsmith', name: '雕金匠', short: '雕金' },
  { id: 'leatherworker', name: '製革匠', short: '製革' },
  { id: 'weaver', name: '裁衣匠', short: '裁衣' },
  { id: 'alchemist', name: '鍊金術士', short: '鍊金' },
  { id: 'culinarian', name: '烹調師', short: '烹調' },
]

const store = useWorkbenchStore()
const client = new SolverWorkerClient()
const data = ref<RecipeData>()
const dataError = ref('')
const searchQuery = ref('')
const levelInput = ref(100)
const profileMessage = ref('')
const editingProfileId = ref<string>()
const solvePhase = ref<'idle' | 'solving' | 'success' | 'failure'>('idle')
const solveMessage = ref('')
const copiedSection = ref<number>()
let copiedResetTimer: ReturnType<typeof setTimeout> | undefined

const profileDraft = reactive<AttributeProfileInput>({
  name: '方案 1',
  level: 100,
  craftsmanship: 0,
  control: 0,
  craftPoints: 0,
  foodNote: '',
  medicineNote: '',
  isSpecialist: false,
})

const solverForm = reactive({
  maximumQuality: true,
  targetQuality: 0,
  adversarial: true,
  useManipulation: false,
  useTrainedEye: false,
  backloadProgress: false,
  includeMacroLock: false,
})

const currentWorkspace = computed(() => store.document.jobs[store.selectedJob])
const activeProfile = computed(() =>
  currentWorkspace.value.profiles.find(
    (profile) => profile.id === currentWorkspace.value.activeProfileId,
  ),
)
const selectedRecord = computed(() =>
  currentWorkspace.value.recipes.find((recipe) => recipe.recipeId === store.selectedRecipeId),
)
const selectedRecipe = computed(() =>
  data.value?.recipes.find((recipe) => recipe.id === store.selectedRecipeId),
)
const savedRecipes = computed(() =>
  currentWorkspace.value.recipes.map((record) => ({
    record,
    recipe: data.value?.recipes.find((recipe) => recipe.id === record.recipeId),
  })),
)
const searchResults = computed(() => {
  if (data.value === undefined) return []
  return searchRecipes(data.value.recipes, store.selectedJob, searchQuery.value).slice(0, 30)
})
const selectedResolution = computed(() => {
  if (data.value === undefined || selectedRecipe.value === undefined || selectedRecord.value === undefined) {
    return undefined
  }
  try {
    return {
      value: resolveRecipeLevel(
        selectedRecipe.value,
        selectedRecord.value.currentLevel,
        data.value.recipeLevels,
        data.value.dynamic,
      ),
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
})
const isDynamic = computed(() => selectedResolution.value?.value?.isDynamic ?? false)
const effectiveRecipe = computed(() => {
  if (selectedRecipe.value === undefined || selectedResolution.value?.value === undefined) return undefined
  return calculateRecipeValues(selectedRecipe.value, selectedResolution.value.value.recipeLevel)
})
const currentSolution = computed(() => {
  const record = selectedRecord.value
  return record?.solutionsByLevel[String(record.currentLevel)]
})
const currentSolverOptions = computed<SolverOptions>(() => ({
  ...(solverForm.maximumQuality ? {} : { targetQuality: solverForm.targetQuality }),
  useManipulation: solverForm.useManipulation,
  useHeartAndSoul: activeProfile.value?.isSpecialist ?? false,
  useQuickInnovation: activeProfile.value?.isSpecialist ?? false,
  useTrainedEye: solverForm.useTrainedEye,
  backloadProgress: solverForm.backloadProgress,
  adversarial: solverForm.adversarial,
}))
const currentFingerprint = computed(() => {
  const recipe = selectedRecipe.value
  const record = selectedRecord.value
  const resolution = selectedResolution.value?.value
  const profile = activeProfile.value
  if (recipe === undefined || record === undefined || resolution === undefined || profile === undefined) {
    return undefined
  }
  return buildSolutionFingerprint({
    recipeId: recipe.id,
    playerLevel: record.currentLevel,
    recipeLevel: resolution.recipeLevel,
    recipeFactors: recipeFactors(recipe),
    profile,
    options: currentSolverOptions.value,
  })
})
const solutionIsStale = computed(() => {
  if (currentSolution.value === undefined || currentFingerprint.value === undefined) return false
  return isSolutionStale(currentSolution.value, currentFingerprint.value)
})
const displayedMacro = computed(() => {
  if (currentSolution.value === undefined) return undefined
  return formatMacro(currentSolution.value.response.actions, {
    includeMacroLock: solverForm.includeMacroLock,
  })
})
const solutionHistory = computed(() =>
  Object.values(selectedRecord.value?.solutionsByLevel ?? {}).sort(
    (left, right) => right.playerLevel - left.playerLevel,
  ),
)
const otherSolutions = computed(() =>
  solutionHistory.value.filter((solution) => solution.playerLevel !== selectedRecord.value?.currentLevel),
)

watch(
  () => selectedRecord.value?.currentLevel,
  (level) => {
    if (level !== undefined) levelInput.value = level
  },
  { immediate: true },
)

watch(
  () => selectedRecord.value?.recipeId,
  () => loadSolverPreferences(),
  { immediate: true },
)

watch(
  () => [store.selectedJob, currentWorkspace.value.activeProfileId] as const,
  () => loadActiveProfileDraft(),
  { immediate: true },
)

onMounted(async () => {
  store.hydrate()
  store.selectedRecipeId ??= currentWorkspace.value.recipes[0]?.recipeId
  loadActiveProfileDraft()
  try {
    data.value = await loadRecipeData()
  } catch (error) {
    dataError.value = error instanceof Error ? error.message : String(error)
  }
})

onBeforeUnmount(() => {
  client.dispose()
  if (copiedResetTimer !== undefined) clearTimeout(copiedResetTimer)
})

function selectJob(job: CraftJob): void {
  store.selectJob(job)
  searchQuery.value = ''
  solveMessage.value = ''
}

function openSearchRecipe(recipe: RecipeRecord): void {
  if (data.value === undefined) return
  const originalLevel = data.value.recipeLevels.find((level) => level.id === recipe.recipeLevelId)
  if (originalLevel === undefined) {
    dataError.value = `本機資料缺少 RecipeLevel ${recipe.recipeLevelId}。`
    return
  }
  const dynamic = data.value.dynamic.recipeIds.includes(recipe.id)
  const profileLevel = activeProfile.value?.level
  const initialLevel = dynamic && profileLevel !== undefined && profileLevel >= 10 ? profileLevel : originalLevel.classJobLevel
  store.openRecipe(recipe.id, initialLevel)
  searchQuery.value = ''
}

function applyLevel(): void {
  if (selectedRecord.value === undefined) return
  try {
    store.changeRecipeLevel(selectedRecord.value.recipeId, levelInput.value)
    solveMessage.value = ''
  } catch (error) {
    solvePhase.value = 'failure'
    solveMessage.value = error instanceof Error ? error.message : String(error)
  }
}

function loadSolverPreferences(): void {
  const preferences = selectedRecord.value?.preferences
  if (preferences === undefined) return
  solverForm.maximumQuality = preferences.solverOptions.targetQuality === undefined
  solverForm.targetQuality = preferences.solverOptions.targetQuality ?? 0
  solverForm.adversarial = preferences.solverOptions.adversarial
  solverForm.useManipulation = preferences.solverOptions.useManipulation
  solverForm.useTrainedEye = preferences.solverOptions.useTrainedEye
  solverForm.backloadProgress = preferences.solverOptions.backloadProgress
  solverForm.includeMacroLock = preferences.includeMacroLock
}

function saveSolverPreferences(): void {
  if (selectedRecord.value === undefined) return
  store.updateRecipePreferences(selectedRecord.value.recipeId, {
    solverOptions: currentSolverOptions.value,
    includeMacroLock: solverForm.includeMacroLock,
  })
}

function loadActiveProfileDraft(): void {
  const profile = activeProfile.value
  if (profile === undefined) {
    editingProfileId.value = undefined
    resetProfileDraft()
    return
  }
  editingProfileId.value = profile.id
  Object.assign(profileDraft, profileInput(profile))
}

function startNewProfile(): void {
  editingProfileId.value = undefined
  resetProfileDraft()
  profileDraft.name = `方案 ${currentWorkspace.value.profiles.length + 1}`
  profileMessage.value = ''
}

function saveProfile(): void {
  try {
    if (editingProfileId.value === undefined) {
      const id = store.addProfile({ ...profileDraft })
      editingProfileId.value = id
    } else {
      store.editProfile(editingProfileId.value, { ...profileDraft })
    }
    profileMessage.value = '能力值方案已保存。'
  } catch (error) {
    profileMessage.value = error instanceof Error ? error.message : String(error)
  }
}

function activateProfile(event: Event): void {
  const profileId = (event.target as HTMLSelectElement).value
  store.activateProfile(profileId)
  loadActiveProfileDraft()
}

async function solveRecipe(): Promise<void> {
  const recipe = selectedRecipe.value
  const record = selectedRecord.value
  const resolution = selectedResolution.value?.value
  const profile = activeProfile.value
  if (recipe === undefined || record === undefined || resolution === undefined || profile === undefined) {
    failSolve({
      code: selectedResolution.value?.error ? 'recipe_level_mapping_failed' : 'invalid_input',
      message: selectedResolution.value?.error ?? '請先選擇配方並建立能力值方案。',
    })
    return
  }
  if (resolution.isDynamic && profile.level !== record.currentLevel) {
    failSolve({
      code: 'invalid_input',
      message: `動態配方目前是 Lv.${record.currentLevel}，請選擇同為 Lv.${record.currentLevel} 的能力值方案。`,
    })
    return
  }
  if (
    profile.craftsmanship < recipe.requiredCraftsmanship ||
    profile.control < recipe.requiredControl
  ) {
    const error: SolverFailure = {
      code: 'insufficient_attributes',
      message: `能力值不足：需要作業精度 ${recipe.requiredCraftsmanship}、加工精度 ${recipe.requiredControl}。`,
    }
    failSolve(error)
    return
  }

  solvePhase.value = 'solving'
  solveMessage.value = '正在瀏覽器 Worker 中求解…'
  const solveResult = await client.solve(
    createSolveRequest(
      {
        level: profile.level,
        craftsmanship: profile.craftsmanship,
        control: profile.control,
        craftPoints: profile.craftPoints,
      },
      recipe,
      resolution.recipeLevel,
      currentSolverOptions.value,
    ),
  )

  if (!solveResult.ok) {
    failSolve(solveResult.error)
    return
  }

  try {
    const solvedAt = new Date().toISOString()
    const macro = formatMacro(solveResult.value.actions, {
      includeMacroLock: solverForm.includeMacroLock,
    })
    store.adopt(
      recipe.id,
      createSolutionSnapshot({
        recipeId: recipe.id,
        playerLevel: record.currentLevel,
        recipeLevel: resolution.recipeLevel,
        recipeFactors: recipeFactors(recipe),
        profile: { ...profile },
        options: currentSolverOptions.value,
        response: solveResult.value,
        macro,
        solvedAt,
      }),
    )
    solvePhase.value = 'success'
    solveMessage.value = '求解與同版本模擬驗證完成。'
  } catch (error) {
    failSolve({
      code: 'unexpected',
      message: `解答保存失敗：${error instanceof Error ? error.message : String(error)}`,
    })
  }
}

function failSolve(error: SolverFailure): void {
  if (selectedRecord.value !== undefined) store.recordFailure(selectedRecord.value.recipeId, error)
  solvePhase.value = 'failure'
  solveMessage.value = error.message
}

function cancelSolve(): void {
  client.cancel()
}

async function copySection(index: number, text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    copiedSection.value = index
    if (copiedResetTimer !== undefined) clearTimeout(copiedResetTimer)
    copiedResetTimer = setTimeout(() => {
      copiedSection.value = undefined
      copiedResetTimer = undefined
    }, 1_500)
  } catch (error) {
    solvePhase.value = 'failure'
    solveMessage.value = `複製巨集失敗：${String(error)}`
  }
}

function confirmRemoveRecipe(): void {
  const recipe = selectedRecipe.value
  if (recipe === undefined) return
  if (window.confirm(`要移除「${recipe.name}」（配方 ID ${recipe.id}）及其本機解答嗎？`)) {
    store.removeRecipe(recipe.id)
  }
}

function confirmClearAll(): void {
  if (
    window.confirm(
      '要清除 FF14_Moon 在此瀏覽器保存的所有職業、配方、能力值方案與解答嗎？此操作無法復原。',
    )
  ) {
    store.clearAll()
    editingProfileId.value = undefined
    resetProfileDraft()
  }
}

function resetProfileDraft(): void {
  Object.assign(profileDraft, {
    name: '方案 1',
    level: 100,
    craftsmanship: 0,
    control: 0,
    craftPoints: 0,
    foodNote: '',
    medicineNote: '',
    isSpecialist: false,
  })
}

function profileInput(profile: AttributeProfile): AttributeProfileInput {
  return {
    name: profile.name,
    level: profile.level,
    craftsmanship: profile.craftsmanship,
    control: profile.control,
    craftPoints: profile.craftPoints,
    foodNote: profile.foodNote,
    medicineNote: profile.medicineNote,
    isSpecialist: profile.isSpecialist,
  }
}

function recipeFactors(recipe: RecipeRecord) {
  return {
    difficulty: recipe.difficultyFactor,
    quality: recipe.qualityFactor,
    durability: recipe.durabilityFactor,
  }
}

function formatTime(value?: string): string {
  return value === undefined ? '尚未' : new Date(value).toLocaleString('zh-TW')
}
</script>

<template>
  <div class="workbench-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">繁中服 Patch 7.2 · local-first</p>
        <h1>FF14 月面工程小工具</h1>
        <p>動態配方工作台</p>
      </div>
      <button class="danger ghost" data-testid="clear-all" @click="confirmClearAll">清除全部資料</button>
    </header>

    <p v-if="store.storageError" class="alert error" data-testid="storage-error">
      {{ store.storageError.message }}
      <span v-if="store.storageWriteBlocked">請先清除舊資料，否則不會覆寫原始內容。</span>
    </p>
    <p v-if="dataError" class="alert error">{{ dataError }}</p>

    <nav class="job-tabs" aria-label="生產職業">
      <button
        v-for="job in JOBS"
        :key="job.id"
        :class="{ active: store.selectedJob === job.id }"
        :aria-pressed="store.selectedJob === job.id"
        @click="selectJob(job.id)"
      >
        <span>{{ job.short }}</span>
        <small>{{ store.document.jobs[job.id].recipes.length }}</small>
      </button>
    </nav>

    <div class="workbench-grid">
      <aside class="workbench-sidebar" data-testid="workbench-sidebar">
        <section class="panel profile-panel" data-testid="profile-panel">
          <div class="section-heading">
            <div><p class="section-label">當前能力值</p><h2>能力值方案</h2></div>
            <button class="ghost compact" @click="startNewProfile">新增方案</button>
          </div>
          <label v-if="currentWorkspace.profiles.length" class="field">
            <span>啟用方案</span>
            <select data-testid="profile-select" :value="currentWorkspace.activeProfileId" @change="activateProfile">
              <option v-for="profile in currentWorkspace.profiles" :key="profile.id" :value="profile.id">
                {{ profile.name }} · Lv.{{ profile.level }}
              </option>
            </select>
          </label>
          <div class="profile-fields">
            <label class="field wide"><span>方案名稱</span><input v-model.trim="profileDraft.name" /></label>
            <label class="field"><span>職業等級</span><input v-model.number="profileDraft.level" type="number" min="1" max="100" /></label>
            <label class="field"><span>作業精度</span><input v-model.number="profileDraft.craftsmanship" type="number" min="1" /></label>
            <label class="field"><span>加工精度</span><input v-model.number="profileDraft.control" type="number" min="1" /></label>
            <label class="field"><span>CP</span><input v-model.number="profileDraft.craftPoints" type="number" min="0" /></label>
            <label class="field wide"><span>食物備註</span><input v-model="profileDraft.foodNote" placeholder="僅記錄，請輸入增益後最終數值" /></label>
            <label class="field wide"><span>藥品備註</span><input v-model="profileDraft.medicineNote" placeholder="僅記錄，請輸入增益後最終數值" /></label>
          </div>
          <label class="check-field">
            <input v-model="profileDraft.isSpecialist" type="checkbox" />
            這是專家職業方案（由使用者自行確認，與配方是否為專家配方分開）
          </label>
          <div class="inline-actions">
            <button data-testid="save-profile" @click="saveProfile">保存方案</button>
            <span class="form-message">{{ profileMessage }}</span>
          </div>
        </section>

        <section class="recipe-sidebar panel">
          <label class="field">
            <span>搜尋 {{ JOBS.find((job) => job.id === store.selectedJob)?.name }} 配方</span>
            <input v-model="searchQuery" type="search" placeholder="輸入繁中配方名稱" data-testid="recipe-search" />
          </label>

          <ul v-if="searchResults.length" class="search-results" aria-label="搜尋結果">
            <li v-for="recipe in searchResults" :key="recipe.id">
              <button @click="openSearchRecipe(recipe)">
                <strong>{{ recipe.name || `未命名配方 ${recipe.id}` }}</strong>
                <span>
                  ID {{ recipe.id }} ·
                  {{ data?.dynamic.recipeIds.includes(recipe.id) ? '動態' : '固定' }}
                  <template v-if="recipe.isExpert"> · 專家配方</template>
                </span>
              </button>
            </li>
          </ul>

          <div class="section-heading">
            <h2>已查詢配方</h2>
            <span>{{ currentWorkspace.recipes.length }}</span>
          </div>
          <p v-if="!currentWorkspace.recipes.length" class="empty">搜尋並選擇配方後會保存在這裡。</p>
          <ul class="saved-recipes">
            <li v-for="entry in savedRecipes" :key="entry.record.recipeId">
              <button
                :class="{ active: store.selectedRecipeId === entry.record.recipeId }"
                @click="store.viewRecipe(entry.record.recipeId)"
              >
                <strong>{{ entry.recipe?.name || `配方 ${entry.record.recipeId}` }}</strong>
                <span>Lv.{{ entry.record.currentLevel }} · {{ formatTime(entry.record.lastViewedAt) }}</span>
              </button>
            </li>
          </ul>
        </section>
      </aside>

      <main class="workbench-main">
        <section v-if="selectedRecipe && selectedRecord" class="panel recipe-detail">
          <div class="section-heading">
            <div>
              <p class="section-label">{{ selectedRecipe.jobName }} · 配方 ID {{ selectedRecipe.id }}</p>
              <h2>{{ selectedRecipe.name }}</h2>
            </div>
            <button class="danger ghost compact" data-testid="remove-recipe" @click="confirmRemoveRecipe">移除此配方</button>
          </div>

          <div class="badges">
            <span :class="isDynamic ? 'dynamic' : 'fixed'">{{ isDynamic ? '動態配方' : '固定配方' }}</span>
            <span v-if="selectedRecipe.isExpert" class="expert">專家配方</span>
            <span v-else>普通配方</span>
          </div>

          <p v-if="selectedRecipe.cosmicDutyAction" class="alert info" data-testid="cosmic-action">
            宇宙任務動作「{{ selectedRecipe.cosmicDutyAction.name }}」最多可用
            {{ selectedRecipe.cosmicDutyAction.maxCharges }} 次。Patch 7.2 稽核確認它不改變 Raphael
            合成狀態，因此僅記錄限制，不會自動加入巨集。
          </p>

          <div class="level-row">
            <label class="field">
              <span>{{ isDynamic ? '玩家目前職業等級' : '固定配方等級' }}</span>
              <input
                v-model.number="levelInput"
                type="number"
                :min="isDynamic ? 10 : 1"
                max="100"
                :disabled="!isDynamic"
                data-testid="recipe-level"
                @change="applyLevel"
              />
            </label>
            <p v-if="isDynamic">網站會套用完整已稽核資料；不會直接把此數字當成內部 ID。</p>
          </div>

          <p v-if="selectedResolution?.error" class="alert error">{{ selectedResolution.error }}</p>
          <dl v-if="effectiveRecipe && selectedResolution?.value" class="facts">
            <div><dt>進展</dt><dd>{{ effectiveRecipe.difficulty }}</dd></div>
            <div><dt>品質</dt><dd>{{ effectiveRecipe.quality }}</dd></div>
            <div><dt>耐久</dt><dd>{{ effectiveRecipe.durability }}</dd></div>
            <div class="internal-fact"><dt>稽核 RecipeLevel</dt><dd>{{ selectedResolution.value.recipeLevel.id }}</dd></div>
          </dl>

          <div class="solver-options">
            <label class="check-field"><input v-model="solverForm.maximumQuality" type="checkbox" @change="saveSolverPreferences" /> 目標為最高品質</label>
            <label v-if="!solverForm.maximumQuality" class="field"><span>自訂目標品質</span><input v-model.number="solverForm.targetQuality" type="number" min="0" :max="effectiveRecipe?.quality" @change="saveSolverPreferences" /></label>
            <label class="check-field"><input v-model="solverForm.adversarial" type="checkbox" @change="saveSolverPreferences" /> 可靠／最壞狀況求解</label>
            <label class="check-field"><input v-model="solverForm.useManipulation" type="checkbox" @change="saveSolverPreferences" /> 我已學會「掌握」</label>
            <label class="check-field"><input v-model="solverForm.useTrainedEye" type="checkbox" @change="saveSolverPreferences" /> 允許「工匠的神速技巧」</label>
            <label class="check-field"><input v-model="solverForm.backloadProgress" type="checkbox" @change="saveSolverPreferences" /> 將進展技能排在後段</label>
            <label class="check-field"><input v-model="solverForm.includeMacroLock" type="checkbox" @change="saveSolverPreferences" /> 巨集加入 /mlock（預設關閉）</label>
          </div>

          <div class="solve-bar">
            <button :disabled="solvePhase === 'solving'" data-testid="solve-recipe" @click="solveRecipe">
              {{ currentSolution ? '重新求解' : '執行求解' }}
            </button>
            <button v-if="solvePhase === 'solving'" class="ghost" @click="cancelSolve">取消</button>
            <span :data-state="solvePhase" data-testid="solve-status">{{ solveMessage }}</span>
          </div>

          <p v-if="selectedRecord.latestSolveError" class="alert error">
            最近求解失敗：{{ selectedRecord.latestSolveError.message }}
          </p>

          <section v-if="currentSolution" class="solution" data-testid="solution-result">
            <div class="section-heading">
              <div><p class="section-label">目前等級最佳解</p><h2>Lv.{{ currentSolution.playerLevel }} 解答</h2></div>
              <span :class="solutionIsStale ? 'stale-pill' : 'fresh-pill'">
                {{ solutionIsStale ? '使用舊能力值／選項求解' : '與目前設定一致' }}
              </span>
            </div>
            <div class="badges result-badges">
              <span :class="currentSolution.response.simulation.completed ? 'dynamic' : 'expert'">
                {{ currentSolution.response.simulation.completed ? '製作完成' : '未完成' }}
              </span>
              <span :class="currentSolution.response.simulation.targetQualityReached ? 'dynamic' : 'expert'">
                {{ currentSolution.response.simulation.targetQualityReached ? '品質目標達成' : '未達品質目標' }}
              </span>
              <span :class="currentSolution.options.adversarial ? 'dynamic' : 'expert'">
                {{ currentSolution.options.adversarial ? '可靠／最壞狀況' : '非保證解答' }}
              </span>
            </div>
            <p v-if="!currentSolution.options.adversarial" class="alert warning">此解答未使用可靠／最壞狀況模式，不保證所有狀況。</p>
            <dl class="facts">
              <div><dt>進展</dt><dd>{{ currentSolution.response.simulation.finalStatus.progress }}</dd></div>
              <div><dt>品質</dt><dd>{{ currentSolution.response.simulation.finalStatus.quality }}</dd></div>
              <div><dt>剩餘耐久</dt><dd>{{ currentSolution.response.simulation.finalStatus.durability }}</dd></div>
              <div><dt>剩餘 CP</dt><dd>{{ currentSolution.response.simulation.finalStatus.craftPoints }}</dd></div>
              <div><dt>步數</dt><dd>{{ currentSolution.response.actions.length }}</dd></div>
              <div><dt>巨集時間</dt><dd>{{ displayedMacro?.estimatedSeconds }} 秒</dd></div>
            </dl>
            <p class="snapshot-note">
              使用方案「{{ currentSolution.profile.name }}」：Lv.{{ currentSolution.profile.level }} ／
              {{ currentSolution.profile.craftsmanship }}／{{ currentSolution.profile.control }}／{{ currentSolution.profile.craftPoints }} CP；
              求解於 {{ formatTime(currentSolution.solvedAt) }}
            </p>

            <div>
              <h3>技能序列</h3>
              <ol class="action-sequence" data-testid="action-sequence">
                <li v-for="(action, index) in currentSolution.response.actions" :key="`${index}-${action}`">
                  {{ ZH_TW_ACTION_NAMES[action] }}
                </li>
              </ol>
            </div>

            <article v-for="section in displayedMacro?.sections" :key="section.index" class="macro-card">
              <div class="section-heading">
                <h3>巨集 #{{ section.index }} · {{ section.lines.length }} 行</h3>
                <button class="compact" :data-testid="`copy-section-${section.index}`" @click="copySection(section.index, section.text)">
                  {{ copiedSection === section.index ? '已複製' : '複製此段' }}
                </button>
              </div>
              <pre
                class="copyable-macro"
                role="button"
                tabindex="0"
                :aria-label="`複製巨集 #${section.index}`"
                @click="copySection(section.index, section.text)"
                @keydown.enter.prevent="copySection(section.index, section.text)"
                @keydown.space.prevent="copySection(section.index, section.text)"
              >{{ section.text }}</pre>
            </article>
          </section>

          <details v-if="otherSolutions.length" class="history" data-testid="solution-history">
            <summary>其他等級解答（{{ otherSolutions.length }}）</summary>
            <ul>
              <li v-for="solution in otherSolutions" :key="solution.playerLevel">
                Lv.{{ solution.playerLevel }} · {{ solution.response.actions.length }} 步 · {{ formatTime(solution.solvedAt) }}
              </li>
            </ul>
          </details>
        </section>

        <section v-else class="panel empty-state">
          <h2>先從左側搜尋配方</h2>
          <p>同一職業再次選擇同一 Recipe ID 會開啟既有紀錄，不會建立重複項目。</p>
        </section>
      </main>
    </div>
    <LegalFooter />
  </div>
</template>
