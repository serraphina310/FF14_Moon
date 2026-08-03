<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  calculateInitialQuality,
  calculateRecipeValues,
  loadRecipeData,
  resolveRecipeLevel,
  searchRecipes,
  type CraftJob,
  type HqIngredient,
  type RecipeData,
  type RecipeRecord,
} from '../data/recipes'
import {
  buildSolutionFingerprint,
  createSolutionSnapshot,
  isSolutionStale,
  type AttributeProfile,
  type AttributeProfileInput,
  type SavedRecipe,
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
const jobLevelInput = ref(100)
const profileMessage = ref('')
const profilePanelOpen = ref(true)
const recipeListMode = ref<'history' | 'retained'>('history')
const selectedHistoryIds = ref<number[]>([])
const editingProfileId = ref<string>()
const solvePhase = ref<'idle' | 'solving' | 'success' | 'failure'>('idle')
const solveMessage = ref('')
const copiedSection = ref<number>()
const solverOptionsPanel = ref<HTMLDetailsElement>()
let copiedResetTimer: ReturnType<typeof setTimeout> | undefined

const profileDraft = reactive<AttributeProfileInput>({
  name: '配裝 1',
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
  initialQuality: 0,
  initialQualityMode: 'manual' as 'manual' | 'ingredients',
  hqIngredientAmounts: {} as Record<string, number>,
  adversarial: false,
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
type RecipeListEntry = { record: SavedRecipe; recipe?: RecipeRecord }
const historyRecipes = computed(() => recipeEntries(currentWorkspace.value.historyRecipeIds))
const retainedRecipes = computed(() => recipeEntries(currentWorkspace.value.retainedRecipeIds))
const selectedHistoryCount = computed(() => selectedHistoryIds.value.length)
const activeProfileMatchesLevel = computed(
  () => activeProfile.value?.level === currentWorkspace.value.currentLevel,
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
        currentWorkspace.value.currentLevel,
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
const hqIngredients = computed<HqIngredient[]>(() =>
  data.value?.ingredients.recipes.find(
    (recipe) => recipe.recipeId === selectedRecipe.value?.id,
  )?.ingredients ?? [],
)
const canCalculateInitialQuality = computed(
  () =>
    hqIngredients.value.length > 0 &&
    (selectedRecipe.value?.materialQualityFactor ?? 0) > 0,
)
const currentSolution = computed(() => {
  const record = selectedRecord.value
  return record?.solutionsByLevel[String(currentWorkspace.value.currentLevel)]
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
    playerLevel: currentWorkspace.value.currentLevel,
    recipeLevel: resolution.recipeLevel,
    recipeFactors: recipeFactors(recipe),
    initialQuality: solverForm.initialQuality,
    profile,
    options: currentSolverOptions.value,
  })
})
const solutionIsStale = computed(() => {
  if (currentSolution.value === undefined) return false
  if (currentFingerprint.value === undefined) return true
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
  solutionHistory.value.filter((solution) => solution.playerLevel !== currentWorkspace.value.currentLevel),
)

watch(
  () => currentWorkspace.value.currentLevel,
  (level) => {
    jobLevelInput.value = level
    syncAutomaticInitialQuality()
    solveMessage.value = ''
  },
  { immediate: true },
)

watch(
  () => selectedRecord.value?.recipeId,
  () => {
    loadSolverPreferences()
    syncAutomaticInitialQuality()
  },
  { immediate: true },
)

watch(
  () => [store.selectedJob, currentWorkspace.value.activeProfileId] as const,
  () => loadActiveProfileDraft(),
  { immediate: true },
)

onMounted(async () => {
  store.hydrate()
  store.selectedRecipeId ??=
    currentWorkspace.value.historyRecipeIds[0] ?? currentWorkspace.value.retainedRecipeIds[0]
  loadActiveProfileDraft()
  profilePanelOpen.value = activeProfile.value === undefined
  try {
    data.value = await loadRecipeData()
    loadSolverPreferences()
    syncAutomaticInitialQuality()
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
  profilePanelOpen.value = activeProfile.value === undefined
  recipeListMode.value = 'history'
  selectedHistoryIds.value = []
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
  const isNewRecipe = !currentWorkspace.value.recipes.some(
    (record) => record.recipeId === recipe.id,
  )
  store.openRecipe(recipe.id)
  if (isNewRecipe) {
    const auditedIngredients = data.value.ingredients.recipes.find(
      (entry) => entry.recipeId === recipe.id,
    )?.ingredients
    if (recipe.materialQualityFactor > 0 && auditedIngredients?.length) {
      const preferences = store.requireRecipe(recipe.id).preferences
      store.updateRecipePreferences(recipe.id, {
        ...preferences,
        initialQualityMode: 'ingredients',
        hqIngredientAmounts: Object.fromEntries(
          auditedIngredients.map((ingredient) => [String(ingredient.slot), 0]),
        ),
      })
      loadSolverPreferences()
      syncAutomaticInitialQuality()
    }
  }
  searchQuery.value = ''
}

function applyJobLevel(): void {
  try {
    store.changeJobLevel(jobLevelInput.value)
    loadActiveProfileDraft()
    syncAutomaticInitialQuality()
    solveMessage.value = ''
  } catch (error) {
    solvePhase.value = 'failure'
    solveMessage.value = error instanceof Error ? error.message : String(error)
  }
}

function retainSelectedHistory(): void {
  if (selectedHistoryIds.value.length === 0) return
  store.retain(selectedHistoryIds.value)
  selectedHistoryIds.value = []
}

function retainCurrentRecipe(): void {
  if (selectedRecord.value === undefined) return
  store.retain([selectedRecord.value.recipeId])
}

function isRetained(recipeId: number): boolean {
  return currentWorkspace.value.retainedRecipeIds.includes(recipeId)
}

function selectAllHistory(): void {
  selectedHistoryIds.value = historyRecipes.value.map((entry) => entry.record.recipeId)
}

function confirmClearHistory(): void {
  const jobName = JOBS.find((job) => job.id === store.selectedJob)?.name ?? store.selectedJob
  if (window.confirm(`要清除${jobName}的最近查詢清單嗎？配方設定、保留項目與解答不會被刪除。`)) {
    store.clearHistory()
    selectedHistoryIds.value = []
  }
}

function createCurrentLevelProfile(): void {
  const source = activeProfile.value
  if (source === undefined) {
    profilePanelOpen.value = true
    startNewProfile()
    return
  }
  const level = currentWorkspace.value.currentLevel
  const id = store.addProfile({
    ...profileInput(source),
    name: `${source.name} Lv.${level}`,
    level,
  })
  editingProfileId.value = id
  loadActiveProfileDraft()
  profileMessage.value = `已沿用目前能力值建立 Lv.${level} 配裝，請確認數值是否正確。`
  profilePanelOpen.value = true
}

function loadSolverPreferences(): void {
  const preferences = selectedRecord.value?.preferences
  if (preferences === undefined) return
  solverForm.maximumQuality = preferences.solverOptions.targetQuality === undefined
  solverForm.targetQuality = preferences.solverOptions.targetQuality ?? 0
  solverForm.initialQuality = preferences.initialQuality
  solverForm.initialQualityMode = preferences.initialQualityMode
  solverForm.hqIngredientAmounts = { ...preferences.hqIngredientAmounts }
  solverForm.adversarial = preferences.solverOptions.adversarial
  solverForm.useManipulation = preferences.solverOptions.useManipulation
  solverForm.useTrainedEye = preferences.solverOptions.useTrainedEye
  solverForm.backloadProgress = preferences.solverOptions.backloadProgress
  solverForm.includeMacroLock = preferences.includeMacroLock
}

function saveSolverPreferences(): void {
  if (selectedRecord.value === undefined) return
  const error = validateInitialQuality()
  if (error !== undefined) {
    solvePhase.value = 'failure'
    solveMessage.value = error
    return
  }
  try {
    store.updateRecipePreferences(selectedRecord.value.recipeId, {
      initialQuality: solverForm.initialQuality,
      initialQualityMode: solverForm.initialQualityMode,
      hqIngredientAmounts: { ...solverForm.hqIngredientAmounts },
      solverOptions: currentSolverOptions.value,
      includeMacroLock: solverForm.includeMacroLock,
    })
  } catch (error) {
    solvePhase.value = 'failure'
    solveMessage.value = error instanceof Error ? error.message : String(error)
  }
}

function changeInitialQualityMode(): void {
  if (solverForm.initialQualityMode === 'ingredients') {
    syncAutomaticInitialQuality()
    return
  }
  saveSolverPreferences()
}

function syncAutomaticInitialQuality(): void {
  if (
    solverForm.initialQualityMode !== 'ingredients' ||
    !canCalculateInitialQuality.value ||
    effectiveRecipe.value === undefined ||
    selectedRecipe.value === undefined
  ) {
    return
  }
  try {
    solverForm.initialQuality = calculateInitialQuality(
      effectiveRecipe.value.quality,
      selectedRecipe.value.materialQualityFactor,
      hqIngredients.value,
      solverForm.hqIngredientAmounts,
    )
    saveSolverPreferences()
  } catch (error) {
    solvePhase.value = 'failure'
    solveMessage.value = error instanceof Error ? error.message : String(error)
  }
}

function validateInitialQuality(): string | undefined {
  if (!Number.isInteger(solverForm.initialQuality) || solverForm.initialQuality < 0) {
    return '初期品質必須是大於或等於 0 的整數。'
  }
  const maximum = effectiveRecipe.value?.quality
  if (maximum !== undefined && solverForm.initialQuality > maximum) {
    return `初期品質 ${solverForm.initialQuality} 不得高於配方品質上限 ${maximum}。`
  }
  if (solverForm.initialQualityMode === 'ingredients') {
    if (
      !canCalculateInitialQuality.value ||
      effectiveRecipe.value === undefined ||
      selectedRecipe.value === undefined
    ) {
      return '目前配方沒有可用於自動計算的 HQ 素材資料。'
    }
    try {
      calculateInitialQuality(
        effectiveRecipe.value.quality,
        selectedRecipe.value.materialQualityFactor,
        hqIngredients.value,
        solverForm.hqIngredientAmounts,
      )
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }
  return undefined
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

function updateProfilePanelOpen(event: Event): void {
  const details = event.currentTarget
  if (details instanceof HTMLDetailsElement) profilePanelOpen.value = details.open
}

function startNewProfile(): void {
  editingProfileId.value = undefined
  resetProfileDraft()
  profileDraft.name = `配裝 ${currentWorkspace.value.profiles.length + 1}`
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
    profileMessage.value = '配裝已保存。'
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
      message: selectedResolution.value?.error ?? '請先選擇配方並建立配裝。',
    })
    return
  }
  if (profile.level !== currentWorkspace.value.currentLevel) {
    failSolve({
      code: 'invalid_input',
      message: `尚未設定${JOBS.find((job) => job.id === store.selectedJob)?.name ?? ''} Lv.${currentWorkspace.value.currentLevel} 配裝。`,
    })
    return
  }
  const initialQualityError = validateInitialQuality()
  if (initialQualityError !== undefined) {
    failSolve({ code: 'invalid_input', message: initialQualityError })
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
        level: currentWorkspace.value.currentLevel,
        craftsmanship: profile.craftsmanship,
        control: profile.control,
        craftPoints: profile.craftPoints,
      },
      recipe,
      resolution.recipeLevel,
      solverForm.initialQuality,
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
        playerLevel: currentWorkspace.value.currentLevel,
        recipeLevel: resolution.recipeLevel,
        recipeFactors: recipeFactors(recipe),
        initialQuality: solverForm.initialQuality,
        profile: { ...profile },
        options: currentSolverOptions.value,
        response: solveResult.value,
        macro,
        solvedAt,
      }),
    )
    if (solverOptionsPanel.value !== undefined) solverOptionsPanel.value.open = false
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
  confirmRemoveSavedRecipe(recipe.id, recipe.name)
}

function confirmRemoveSavedRecipe(recipeId: number, recipeName: string): void {
  if (window.confirm(`要移除「${recipeName}」（配方 ID ${recipeId}）及其本機解答嗎？`)) {
    store.removeRecipe(recipeId)
  }
}

function confirmClearAll(): void {
  if (
    window.confirm(
      '要清除 FF14_Moon 在此瀏覽器保存的所有職業、配方、配裝與解答嗎？此操作無法復原。',
    )
  ) {
    store.clearAll()
    editingProfileId.value = undefined
    resetProfileDraft()
    profilePanelOpen.value = true
  }
}

function resetProfileDraft(): void {
  Object.assign(profileDraft, {
    name: '配裝 1',
    level: currentWorkspace.value.currentLevel,
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

function recipeEntries(recipeIds: number[]): RecipeListEntry[] {
  return recipeIds.flatMap((recipeId) => {
    const record = currentWorkspace.value.recipes.find((candidate) => candidate.recipeId === recipeId)
    if (record === undefined) return []
    return [{ record, recipe: data.value?.recipes.find((recipe) => recipe.id === recipeId) }]
  })
}

function listSolutionStatus(entry: RecipeListEntry): { label: string; state: 'fresh' | 'stale' | 'empty' | 'error' } {
  const level = currentWorkspace.value.currentLevel
  const solution = entry.record.solutionsByLevel[String(level)]
  if (solution === undefined) return { label: '尚未求解', state: 'empty' }
  const profile = activeProfile.value
  if (entry.recipe === undefined || data.value === undefined || profile?.level !== level) {
    return { label: '解答未更新', state: 'stale' }
  }
  try {
    const resolution = resolveRecipeLevel(entry.recipe, level, data.value.recipeLevels, data.value.dynamic)
    const preferences = entry.record.preferences
    const fingerprint = buildSolutionFingerprint({
      recipeId: entry.recipe.id,
      playerLevel: level,
      recipeLevel: resolution.recipeLevel,
      recipeFactors: recipeFactors(entry.recipe),
      initialQuality: preferences.initialQuality,
      profile,
      options: {
        ...preferences.solverOptions,
        useHeartAndSoul: profile.isSpecialist,
        useQuickInnovation: profile.isSpecialist,
      },
    })
    return isSolutionStale(solution, fingerprint)
      ? { label: '解答未更新', state: 'stale' }
      : { label: '解答已更新', state: 'fresh' }
  } catch {
    return { label: '等級不可用', state: 'error' }
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
        <details
          class="panel profile-panel"
          data-testid="profile-panel"
          :open="profilePanelOpen"
          @toggle="updateProfilePanelOpen"
        >
          <summary class="profile-summary" data-testid="profile-summary">
            <div><p class="section-label">當前能力值</p><h2>配裝</h2></div>
            <label class="summary-level-control" @click.stop @keydown.stop>
              <span>目前職業等級</span>
              <input
                v-model.number="jobLevelInput"
                type="number"
                min="1"
                max="100"
                data-testid="job-level-summary"
                aria-label="目前職業等級"
                @change="applyJobLevel"
              />
            </label>
          </summary>
          <div class="profile-panel-body">
            <div class="profile-toolbar">
              <button class="ghost compact" @click="startNewProfile">新增配裝</button>
            </div>
            <label v-if="currentWorkspace.profiles.length" class="field">
              <span>啟用配裝</span>
              <select data-testid="profile-select" :value="currentWorkspace.activeProfileId" @change="activateProfile">
                <option v-for="profile in currentWorkspace.profiles" :key="profile.id" :value="profile.id">
                  {{ profile.name }} · Lv.{{ profile.level }}
                </option>
              </select>
            </label>
            <div class="profile-fields">
              <label class="field wide"><span>配裝名稱</span><input v-model.trim="profileDraft.name" /></label>
              <label class="field"><span>職業等級</span><input v-model.number="profileDraft.level" type="number" min="1" max="100" /></label>
              <label class="field"><span>作業精度</span><input v-model.number="profileDraft.craftsmanship" type="number" min="1" /></label>
              <label class="field"><span>加工精度</span><input v-model.number="profileDraft.control" type="number" min="1" /></label>
              <label class="field"><span>CP</span><input v-model.number="profileDraft.craftPoints" type="number" min="0" /></label>
              <label class="field wide"><span>食物備註</span><input v-model="profileDraft.foodNote" placeholder="僅記錄，請輸入增益後最終數值" /></label>
              <label class="field wide"><span>藥品備註</span><input v-model="profileDraft.medicineNote" placeholder="僅記錄，請輸入增益後最終數值" /></label>
            </div>
            <label class="check-field">
              <input v-model="profileDraft.isSpecialist" type="checkbox" />
              這是專家職業配裝（由使用者自行確認，與配方是否為專家配方分開）
            </label>
            <div class="inline-actions">
              <button data-testid="save-profile" @click="saveProfile">保存配裝</button>
              <span class="form-message">{{ profileMessage }}</span>
            </div>
          </div>
        </details>

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

          <div class="recipe-list-tabs" role="tablist" aria-label="配方清單">
            <button
              :class="{ active: recipeListMode === 'history' }"
              role="tab"
              :aria-selected="recipeListMode === 'history'"
              data-testid="history-tab"
              @click="recipeListMode = 'history'"
            >
              最近查詢 {{ currentWorkspace.historyRecipeIds.length }}
            </button>
            <button
              :class="{ active: recipeListMode === 'retained' }"
              role="tab"
              :aria-selected="recipeListMode === 'retained'"
              data-testid="retained-tab"
              @click="recipeListMode = 'retained'"
            >
              保留清單 {{ currentWorkspace.retainedRecipeIds.length }}
            </button>
          </div>

          <section v-if="recipeListMode === 'history'" data-testid="history-list-panel">
            <div v-if="historyRecipes.length" class="recipe-list-toolbar">
              <button class="ghost compact" @click="selectAllHistory">全選</button>
              <button class="compact" :disabled="selectedHistoryCount === 0" @click="retainSelectedHistory">
                加入保留清單（{{ selectedHistoryCount }}）
              </button>
              <button class="danger ghost compact" data-testid="clear-history" @click="confirmClearHistory">清除紀錄</button>
            </div>
            <p v-if="!historyRecipes.length" class="empty">搜尋並開啟配方後會依首次查詢順序保存在這裡。</p>
            <ul class="saved-recipes history-recipes">
              <li v-for="entry in historyRecipes" :key="entry.record.recipeId">
                <label class="history-select" :aria-label="`選取${entry.recipe?.name || `配方 ${entry.record.recipeId}`}`">
                  <input v-model="selectedHistoryIds" type="checkbox" :value="entry.record.recipeId" />
                </label>
                <button
                  class="saved-recipe-open"
                  :class="{ active: store.selectedRecipeId === entry.record.recipeId }"
                  @click="store.viewRecipe(entry.record.recipeId)"
                >
                  <strong>{{ entry.recipe?.name || `配方 ${entry.record.recipeId}` }}</strong>
                  <span>
                    Lv.{{ currentWorkspace.currentLevel }} · {{ formatTime(entry.record.lastViewedAt) }} ·
                    <em :data-state="listSolutionStatus(entry).state">{{ listSolutionStatus(entry).label }}</em>
                  </span>
                </button>
                <div class="saved-recipe-actions">
                  <button
                    class="ghost compact"
                    :disabled="isRetained(entry.record.recipeId)"
                    :data-testid="`retain-recipe-${entry.record.recipeId}`"
                    @click="store.retain([entry.record.recipeId])"
                  >
                    {{ isRetained(entry.record.recipeId) ? '已保留' : '保留' }}
                  </button>
                  <button
                    class="saved-recipe-remove"
                    :aria-label="`刪除「${entry.recipe?.name || `配方 ${entry.record.recipeId}`}」（配方 ID ${entry.record.recipeId}）的所有本機資料`"
                    :data-testid="`remove-saved-recipe-${entry.record.recipeId}`"
                    @click="confirmRemoveSavedRecipe(entry.record.recipeId, entry.recipe?.name || `配方 ${entry.record.recipeId}`)"
                  >
                    刪除資料
                  </button>
                </div>
              </li>
            </ul>
          </section>

          <section v-else data-testid="retained-list-panel">
            <p v-if="!retainedRecipes.length" class="empty">從最近查詢勾選常用配方，即可加入保留清單。</p>
            <ul class="saved-recipes retained-recipes">
              <li v-for="entry in retainedRecipes" :key="entry.record.recipeId">
                <button
                  class="saved-recipe-open"
                  :class="{ active: store.selectedRecipeId === entry.record.recipeId }"
                  @click="store.viewRecipe(entry.record.recipeId)"
                >
                  <strong>{{ entry.recipe?.name || `配方 ${entry.record.recipeId}` }}</strong>
                  <span>
                    Lv.{{ currentWorkspace.currentLevel }} ·
                    <em :data-state="listSolutionStatus(entry).state">{{ listSolutionStatus(entry).label }}</em>
                  </span>
                </button>
                <button class="saved-recipe-remove" @click="store.unretain(entry.record.recipeId)">移除</button>
              </li>
            </ul>
          </section>
        </section>
      </aside>

      <main class="workbench-main">
        <section v-if="selectedRecipe && selectedRecord" class="panel recipe-detail">
          <div class="section-heading recipe-heading">
            <div class="recipe-heading-copy">
              <div>
                <p class="section-label">{{ selectedRecipe.jobName }} · 配方 ID {{ selectedRecipe.id }}</p>
                <h2>{{ selectedRecipe.name }}</h2>
              </div>
              <div class="badges recipe-badges">
                <span :class="isDynamic ? 'dynamic' : 'fixed'">{{ isDynamic ? '動態配方' : '固定配方' }}</span>
                <span v-if="selectedRecipe.isExpert" class="expert">專家配方</span>
                <span v-else>普通配方</span>
              </div>
            </div>
            <div class="recipe-heading-actions">
              <button
                v-if="!isRetained(selectedRecord.recipeId)"
                class="ghost compact"
                data-testid="retain-current-recipe"
                @click="retainCurrentRecipe"
              >
                加入保留清單
              </button>
              <button v-else class="ghost compact" @click="store.unretain(selectedRecord.recipeId)">取消保留</button>
              <button class="danger ghost compact" data-testid="remove-recipe" @click="confirmRemoveRecipe">刪除配方資料</button>
            </div>
          </div>

          <p v-if="selectedRecipe.cosmicDutyAction" class="alert info" data-testid="cosmic-action">
            宇宙任務動作「{{ selectedRecipe.cosmicDutyAction.name }}」最多可用
            {{ selectedRecipe.cosmicDutyAction.maxCharges }} 次。Patch 7.2 稽核確認它不改變 Raphael
            合成狀態，因此僅記錄限制，不會自動加入巨集。
          </p>

          <p v-if="selectedResolution?.error" class="alert error">{{ selectedResolution.error }}</p>
          <div class="recipe-parameters">
            <div class="level-row">
              <label class="field">
                <span>{{ isDynamic ? '玩家目前職業等級' : '固定配方等級' }}</span>
                <input
                  v-if="isDynamic"
                  v-model.number="jobLevelInput"
                  type="number"
                  min="10"
                  max="100"
                  data-testid="recipe-level"
                  @change="applyJobLevel"
                />
                <input v-else type="number" :value="selectedResolution?.value?.recipeLevel.classJobLevel" disabled data-testid="recipe-level" />
              </label>
              <p v-if="isDynamic">此職業的所有動態配方共用目前等級；完整稽核映射，不使用內部 ID。</p>
            </div>

            <dl v-if="effectiveRecipe && selectedResolution?.value" class="facts recipe-facts">
              <div><dt>進展</dt><dd>{{ effectiveRecipe.difficulty }}</dd></div>
              <div><dt>品質</dt><dd>{{ effectiveRecipe.quality }}</dd></div>
              <div><dt>耐久</dt><dd>{{ effectiveRecipe.durability }}</dd></div>
            </dl>
          </div>

          <details v-if="selectedResolution?.value" class="technical-details">
            <summary>技術資訊</summary>
            <dl class="facts"><div><dt>RecipeLevel</dt><dd>{{ selectedResolution.value.recipeLevel.id }}</dd></div></dl>
          </details>

          <p v-if="!activeProfileMatchesLevel" class="alert warning" data-testid="missing-level-profile">
            尚未設定{{ JOBS.find((job) => job.id === store.selectedJob)?.name }} Lv.{{ currentWorkspace.currentLevel }} 配裝。
            <button class="compact" @click="createCurrentLevelProfile">
              {{ activeProfile ? '以目前能力值建立同等級配裝' : '建立配裝' }}
            </button>
          </p>

          <details ref="solverOptionsPanel" class="solver-options-panel" data-testid="solver-options-panel">
            <summary data-testid="solver-options-summary">
              <span class="solver-summary-copy">
                <strong>求解選項</strong>
                <small>品質、技能與求解策略</small>
              </span>
              <span class="solver-summary-status">
                <em>{{ solverForm.maximumQuality ? '最高品質' : `品質 ${solverForm.targetQuality}` }}</em>
                <em :class="{ reliable: solverForm.adversarial }">
                  {{ solverForm.adversarial ? '可靠模式' : '非保證' }}
                </em>
              </span>
            </summary>
            <div class="solver-options">
              <section class="solver-option-group solver-quality-group">
                <header class="solver-option-heading">
                  <div>
                    <span class="option-group-kicker">QUALITY</span>
                    <h3>品質目標</h3>
                  </div>
                  <p>設定素材帶入的品質，以及這次求解希望達到的品質。</p>
                </header>
                <div class="solver-quality-controls">
                  <div class="initial-quality-card">
                    <div class="initial-quality-heading">
                      <strong>初期品質</strong>
                      <span class="initial-quality-modes">
                        <label>
                          <input
                            v-model="solverForm.initialQualityMode"
                            type="radio"
                            value="manual"
                            aria-label="手動輸入初期品質"
                            @change="changeInitialQualityMode"
                          />
                          手動輸入
                        </label>
                        <label :class="{ disabled: !canCalculateInitialQuality }">
                          <input
                            v-model="solverForm.initialQualityMode"
                            type="radio"
                            value="ingredients"
                            aria-label="依 HQ 素材計算"
                            :disabled="!canCalculateInitialQuality"
                            @change="changeInitialQualityMode"
                          />
                          依 HQ 素材計算
                        </label>
                      </span>
                    </div>

                    <label class="field solver-number-field initial-quality-value">
                      <span>帶入品質</span>
                      <input
                        v-model.number="solverForm.initialQuality"
                        type="number"
                        min="0"
                        :max="effectiveRecipe?.quality"
                        step="1"
                        data-testid="initial-quality"
                        :readonly="solverForm.initialQualityMode === 'ingredients'"
                        @change="solverForm.initialQualityMode === 'manual' && saveSolverPreferences()"
                      />
                      <small v-if="solverForm.initialQualityMode === 'ingredients'">
                        依素材 HQ 數量與 Item level 自動計算。
                      </small>
                      <small v-else>可直接輸入遊戲顯示的初期品質。</small>
                    </label>

                    <div
                      v-if="solverForm.initialQualityMode === 'ingredients'"
                      class="hq-ingredient-list"
                      data-testid="hq-ingredient-list"
                    >
                      <label
                        v-for="ingredient in hqIngredients"
                        :key="ingredient.slot"
                        class="hq-ingredient-row"
                      >
                        <span>
                          <strong>{{ ingredient.name }}</strong>
                          <small>需要 {{ ingredient.amount }} · Item Lv.{{ ingredient.itemLevel }}</small>
                        </span>
                        <span class="hq-ingredient-input">
                          <input
                            v-model.number="solverForm.hqIngredientAmounts[String(ingredient.slot)]"
                            type="number"
                            min="0"
                            :max="ingredient.amount"
                            step="1"
                            :aria-label="`${ingredient.name} HQ 數量`"
                            :data-testid="`hq-ingredient-${ingredient.slot}`"
                            @change="syncAutomaticInitialQuality"
                          />
                          <b>/ {{ ingredient.amount }} HQ</b>
                        </span>
                      </label>
                    </div>
                  </div>
                  <label class="solver-toggle-card">
                    <input
                      v-model="solverForm.maximumQuality"
                      type="checkbox"
                      aria-label="目標為最高品質"
                      @change="saveSolverPreferences"
                    />
                    <span class="solver-toggle-copy">
                      <strong>目標為最高品質</strong>
                      <small>以配方品質上限作為求解目標。</small>
                    </span>
                  </label>
                  <label v-if="!solverForm.maximumQuality" class="field solver-number-field">
                    <span>自訂目標品質</span>
                    <input
                      v-model.number="solverForm.targetQuality"
                      type="number"
                      min="0"
                      :max="effectiveRecipe?.quality"
                      step="1"
                      @change="saveSolverPreferences"
                    />
                    <small>只要求達到指定品質，可縮短解答。</small>
                  </label>
                </div>
              </section>

              <section class="solver-option-group">
                <header class="solver-option-heading">
                  <div>
                    <span class="option-group-kicker">ACTIONS</span>
                    <h3>可用技能</h3>
                  </div>
                </header>
                <div class="solver-toggle-list">
                  <label class="solver-toggle-card">
                    <input
                      v-model="solverForm.useManipulation"
                      type="checkbox"
                      aria-label="我已學會「掌握」"
                      @change="saveSolverPreferences"
                    />
                    <span class="solver-toggle-copy">
                      <strong>我已學會「掌握」</strong>
                      <small>只有角色已學會此技能時才啟用。</small>
                    </span>
                  </label>
                  <label class="solver-toggle-card">
                    <input
                      v-model="solverForm.useTrainedEye"
                      type="checkbox"
                      aria-label="允許「工匠的神速技巧」"
                      @change="saveSolverPreferences"
                    />
                    <span class="solver-toggle-copy">
                      <strong>允許「工匠的神速技巧」</strong>
                      <small>符合技能條件時，允許求解器使用。</small>
                    </span>
                  </label>
                </div>
              </section>

              <section class="solver-option-group">
                <header class="solver-option-heading">
                  <div>
                    <span class="option-group-kicker">STRATEGY</span>
                    <h3>求解策略與巨集</h3>
                  </div>
                </header>
                <div class="solver-toggle-list">
                  <label class="solver-toggle-card">
                    <input
                      v-model="solverForm.adversarial"
                      type="checkbox"
                      aria-label="可靠／最壞狀況求解"
                      @change="saveSolverPreferences"
                    />
                    <span class="solver-toggle-copy">
                      <strong>可靠／最壞狀況求解</strong>
                      <small>以所有狀況皆可完成為目標，通常步數較長。</small>
                    </span>
                  </label>
                  <label class="solver-toggle-card">
                    <input
                      v-model="solverForm.backloadProgress"
                      type="checkbox"
                      aria-label="將進展技能排在後段"
                      @change="saveSolverPreferences"
                    />
                    <span class="solver-toggle-copy">
                      <strong>將進展技能排在後段</strong>
                      <small>優先處理品質，再完成剩餘進展。</small>
                    </span>
                  </label>
                  <label class="solver-toggle-card">
                    <input
                      v-model="solverForm.includeMacroLock"
                      type="checkbox"
                      aria-label="巨集加入 /mlock（預設關閉）"
                      @change="saveSolverPreferences"
                    />
                    <span class="solver-toggle-copy">
                      <strong>巨集加入 /mlock</strong>
                      <small>在每段巨集開頭加入鎖定指令，預設關閉。</small>
                    </span>
                  </label>
                </div>
              </section>
            </div>
          </details>

          <div class="solve-bar">
            <button :disabled="solvePhase === 'solving'" data-testid="solve-recipe" @click="solveRecipe">
              {{ currentSolution ? (solutionIsStale ? '更新解答' : '重新求解') : '執行求解' }}
            </button>
            <button v-if="solvePhase === 'solving'" class="ghost" @click="cancelSolve">取消</button>
            <span :data-state="solvePhase" data-testid="solve-status">{{ solveMessage }}</span>
          </div>

          <p v-if="selectedRecord.latestSolveError" class="alert error">
            最近求解失敗：{{ selectedRecord.latestSolveError.message }}
          </p>

          <p v-if="!currentSolution" class="alert info" data-testid="current-solution-status">
            Lv.{{ currentWorkspace.currentLevel }} 尚無解答。
          </p>

          <section v-if="currentSolution" class="solution" data-testid="solution-result">
            <div class="section-heading">
              <div><p class="section-label">目前等級最佳解</p><h2>Lv.{{ currentSolution.playerLevel }} 解答</h2></div>
              <span :class="solutionIsStale ? 'stale-pill' : 'fresh-pill'">
                {{ solutionIsStale ? '解答未更新' : '解答已更新' }}
              </span>
            </div>
            <p v-if="solutionIsStale" class="alert warning" data-testid="stale-solution-warning">
              以下解答使用舊能力值或舊選項，請更新後再執行。
            </p>
            <div class="result-layout">
              <div class="result-summary">
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
                  <div><dt>初期品質</dt><dd>{{ currentSolution.initialQuality }}</dd></div>
                  <div><dt>進展</dt><dd>{{ currentSolution.response.simulation.finalStatus.progress }}</dd></div>
                  <div><dt>品質</dt><dd>{{ currentSolution.response.simulation.finalStatus.quality }}</dd></div>
                  <div><dt>剩餘耐久</dt><dd>{{ currentSolution.response.simulation.finalStatus.durability }}</dd></div>
                  <div><dt>剩餘 CP</dt><dd>{{ currentSolution.response.simulation.finalStatus.craftPoints }}</dd></div>
                  <div><dt>步數</dt><dd>{{ currentSolution.response.actions.length }}</dd></div>
                  <div><dt>巨集時間</dt><dd>{{ displayedMacro?.estimatedSeconds }} 秒</dd></div>
                </dl>
                <p class="snapshot-note">
                  使用配裝「{{ currentSolution.profile.name }}」：Lv.{{ currentSolution.profile.level }} ／
                  {{ currentSolution.profile.craftsmanship }}／{{ currentSolution.profile.control }}／{{ currentSolution.profile.craftPoints }} CP；
                  求解於 {{ formatTime(currentSolution.solvedAt) }}
                </p>
              </div>

              <div class="macro-list">
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
              </div>
            </div>

            <details class="action-details">
              <summary>查看技能序列（{{ currentSolution.response.actions.length }} 步）</summary>
              <ol class="action-sequence" data-testid="action-sequence">
                <li v-for="(action, index) in currentSolution.response.actions" :key="`${index}-${action}`">
                  {{ ZH_TW_ACTION_NAMES[action] }}
                </li>
              </ol>
            </details>
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
