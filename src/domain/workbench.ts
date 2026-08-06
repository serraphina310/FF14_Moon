import type { CraftJob } from '../data/recipes'
import type { FormattedMacro } from '../macro/format'
import type {
  RecipeFactors,
  RecipeLevelInput,
  SolveResponse,
  SolverFailure,
  SolverOptions,
} from '../solver/types'
import {
  currentVersions,
  WORKBENCH_SCHEMA_VERSION,
  type VersionSnapshot,
} from './versions'

export const CRAFT_JOBS: readonly CraftJob[] = [
  'carpenter',
  'blacksmith',
  'armorer',
  'goldsmith',
  'leatherworker',
  'weaver',
  'alchemist',
  'culinarian',
]

export interface AttributeProfileInput {
  name: string
  level: number
  craftsmanship: number
  control: number
  craftPoints: number
  foodNote: string
  medicineNote: string
  isSpecialist: boolean
}

export interface AttributeProfile extends AttributeProfileInput {
  id: string
  createdAt: string
  updatedAt: string
}

export interface LatestSolveError extends SolverFailure {
  occurredAt: string
}

export interface SolutionSnapshot {
  recipeId: number
  playerLevel: number
  recipeLevel: RecipeLevelInput
  recipeFactors: RecipeFactors
  initialQuality: number
  profile: AttributeProfile
  options: SolverOptions
  inputFingerprint: string
  response: SolveResponse
  macro: FormattedMacro
  solvedAt: string
  versions: VersionSnapshot
}

export interface SavedRecipe {
  recipeId: number
  createdAt: string
  updatedAt: string
  lastViewedAt: string
  lastSolvedAt?: string
  latestSolveError?: LatestSolveError
  preferences: RecipePreferences
  solutionsByLevel: Record<string, SolutionSnapshot>
}

export interface RecipePreferences {
  initialQuality: number
  initialQualityMode: 'manual' | 'ingredients'
  hqIngredientAmounts: Record<string, number>
  solverOptions: SolverOptions
  includeMacroLock: boolean
}

export interface JobWorkspace {
  currentLevel: number
  recipes: SavedRecipe[]
  historyRecipeIds: number[]
  retainedRecipeIds: number[]
  profiles: AttributeProfile[]
  activeProfileId?: string
}

export interface WorkbenchState {
  schemaVersion: typeof WORKBENCH_SCHEMA_VERSION
  versions: VersionSnapshot
  createdAt: string
  updatedAt: string
  jobs: Record<CraftJob, JobWorkspace>
}

export interface SolutionFingerprintInput {
  recipeId: number
  playerLevel: number
  recipeLevel: RecipeLevelInput
  recipeFactors: RecipeFactors
  initialQuality: number
  profile: AttributeProfile
  options: SolverOptions
  versions?: VersionSnapshot
}

export interface CreateSolutionInput extends SolutionFingerprintInput {
  response: SolveResponse
  macro: FormattedMacro
  solvedAt: string
}

export function createEmptyWorkbench(now: string): WorkbenchState {
  return {
    schemaVersion: WORKBENCH_SCHEMA_VERSION,
    versions: currentVersions(),
    createdAt: now,
    updatedAt: now,
    jobs: Object.fromEntries(
      CRAFT_JOBS.map((job) => [
        job,
        {
          currentLevel: 100,
          recipes: [],
          historyRecipeIds: [],
          retainedRecipeIds: [],
          profiles: [],
        } satisfies JobWorkspace,
      ]),
    ) as Record<CraftJob, JobWorkspace>,
  }
}

export function defaultRecipePreferences(): RecipePreferences {
  return {
    initialQuality: 0,
    initialQualityMode: 'manual',
    hqIngredientAmounts: {},
    solverOptions: {
      useManipulation: false,
      useHeartAndSoul: false,
      useQuickInnovation: false,
      useTrainedEye: false,
      backloadProgress: false,
      adversarial: false,
    },
    includeMacroLock: false,
  }
}

export function openRecipe(
  state: WorkbenchState,
  job: CraftJob,
  recipeId: number,
  now: string,
): SavedRecipe {
  const workspace = state.jobs[job]
  const existing = workspace.recipes.find((recipe) => recipe.recipeId === recipeId)
  if (existing !== undefined) {
    existing.lastViewedAt = now
    existing.updatedAt = now
    if (!workspace.historyRecipeIds.includes(recipeId)) workspace.historyRecipeIds.push(recipeId)
    state.updatedAt = now
    return existing
  }

  const saved: SavedRecipe = {
    recipeId,
    createdAt: now,
    updatedAt: now,
    lastViewedAt: now,
    preferences: defaultRecipePreferences(),
    solutionsByLevel: {},
  }
  workspace.recipes.push(saved)
  workspace.historyRecipeIds.push(recipeId)
  state.updatedAt = now
  return saved
}

export function retainRecipes(
  state: WorkbenchState,
  job: CraftJob,
  recipeIds: number[],
  now: string,
): void {
  const workspace = state.jobs[job]
  const knownRecipeIds = new Set(workspace.recipes.map((recipe) => recipe.recipeId))
  for (const recipeId of recipeIds) {
    if (!knownRecipeIds.has(recipeId)) throw new Error(`找不到要保留的配方 ${recipeId}。`)
    if (!workspace.retainedRecipeIds.includes(recipeId)) workspace.retainedRecipeIds.push(recipeId)
  }
  state.updatedAt = now
}

export function unretainRecipe(
  state: WorkbenchState,
  job: CraftJob,
  recipeId: number,
  now: string,
): void {
  const retained = state.jobs[job].retainedRecipeIds
  const index = retained.indexOf(recipeId)
  if (index !== -1) retained.splice(index, 1)
  state.updatedAt = now
}

export function clearRecipeHistory(state: WorkbenchState, job: CraftJob, now: string): void {
  state.jobs[job].historyRecipeIds = []
  state.updatedAt = now
}

export function setRecipePreferences(
  record: SavedRecipe,
  preferences: RecipePreferences,
  now: string,
): void {
  if (!Number.isInteger(preferences.initialQuality) || preferences.initialQuality < 0) {
    throw new Error('初期品質必須是大於或等於 0 的整數。')
  }
  if (!['manual', 'ingredients'].includes(preferences.initialQualityMode)) {
    throw new Error('初期品質來源無效。')
  }
  if (
    Object.entries(preferences.hqIngredientAmounts).some(
      ([slot, amount]) =>
        !/^\d+$/.test(slot) || !Number.isInteger(amount) || amount < 0,
    )
  ) {
    throw new Error('HQ 素材數量必須是大於或等於 0 的整數。')
  }
  record.preferences = cloneJson(preferences)
  record.updatedAt = now
}

export function setJobLevel(
  state: WorkbenchState,
  job: CraftJob,
  level: number,
  now: string,
): void {
  validateLevel(level)
  const workspace = state.jobs[job]
  workspace.currentLevel = level
  state.updatedAt = now
}

export function removeRecipeRecord(
  state: WorkbenchState,
  job: CraftJob,
  recipeId: number,
  now: string,
): boolean {
  const recipes = state.jobs[job].recipes
  const index = recipes.findIndex((recipe) => recipe.recipeId === recipeId)
  if (index === -1) return false
  recipes.splice(index, 1)
  const workspace = state.jobs[job]
  workspace.historyRecipeIds = workspace.historyRecipeIds.filter((id) => id !== recipeId)
  workspace.retainedRecipeIds = workspace.retainedRecipeIds.filter((id) => id !== recipeId)
  state.updatedAt = now
  return true
}

export function createProfile(
  state: WorkbenchState,
  job: CraftJob,
  input: AttributeProfileInput,
  id: string,
  now: string,
): AttributeProfile {
  validateProfile(input)
  const workspace = state.jobs[job]
  if (workspace.profiles.some((profile) => profile.id === id)) {
    throw new Error(`配裝 ID ${id} 已存在。`)
  }
  const profile: AttributeProfile = { ...input, id, createdAt: now, updatedAt: now }
  workspace.profiles.push(profile)
  workspace.activeProfileId ??= id
  state.updatedAt = now
  return profile
}

export function updateProfile(
  state: WorkbenchState,
  job: CraftJob,
  profileId: string,
  changes: Partial<AttributeProfileInput>,
  now: string,
): AttributeProfile {
  const profile = requireProfile(state, job, profileId)
  const updated: AttributeProfileInput = {
    name: changes.name ?? profile.name,
    level: changes.level ?? profile.level,
    craftsmanship: changes.craftsmanship ?? profile.craftsmanship,
    control: changes.control ?? profile.control,
    craftPoints: changes.craftPoints ?? profile.craftPoints,
    foodNote: changes.foodNote ?? profile.foodNote,
    medicineNote: changes.medicineNote ?? profile.medicineNote,
    isSpecialist: changes.isSpecialist ?? profile.isSpecialist,
  }
  validateProfile(updated)
  Object.assign(profile, updated, { updatedAt: now })
  state.updatedAt = now
  return profile
}

export function setActiveProfile(
  state: WorkbenchState,
  job: CraftJob,
  profileId: string,
  now: string,
): void {
  requireProfile(state, job, profileId)
  state.jobs[job].activeProfileId = profileId
  state.updatedAt = now
}

export function adoptSolution(
  record: SavedRecipe,
  solution: SolutionSnapshot,
  currentLevel: number,
): void {
  if (solution.recipeId !== record.recipeId || solution.playerLevel !== currentLevel) {
    throw new Error('解答的配方或等級與目前紀錄不一致。')
  }
  if (!solution.response.simulation.verified || !solution.response.simulation.completed) {
    throw new Error('只有通過同版本模擬器驗證的完成解答可以保存。')
  }
  record.solutionsByLevel[String(solution.playerLevel)] = cloneJson(solution)
  record.latestSolveError = undefined
  record.lastSolvedAt = solution.solvedAt
  record.updatedAt = solution.solvedAt
}

export function recordSolveFailure(
  record: SavedRecipe,
  error: SolverFailure,
  occurredAt: string,
): void {
  record.latestSolveError = { ...error, occurredAt }
  record.lastSolvedAt = occurredAt
  record.updatedAt = occurredAt
}

export function buildSolutionFingerprint(input: SolutionFingerprintInput): string {
  const versions = input.versions ?? currentVersions()
  return JSON.stringify({
    recipeId: input.recipeId,
    playerLevel: input.playerLevel,
    recipeLevel: input.recipeLevel,
    recipeFactors: input.recipeFactors,
    initialQuality: input.initialQuality,
    profile: {
      id: input.profile.id,
      level: input.profile.level,
      craftsmanship: input.profile.craftsmanship,
      control: input.profile.control,
      craftPoints: input.profile.craftPoints,
      foodNote: input.profile.foodNote,
      medicineNote: input.profile.medicineNote,
      isSpecialist: input.profile.isSpecialist,
    },
    options: input.options,
    versions,
  })
}

export function buildSolutionFreshnessFingerprint(input: SolutionFingerprintInput): string {
  const versions = input.versions ?? currentVersions()
  return JSON.stringify({
    recipeId: input.recipeId,
    playerLevel: input.playerLevel,
    recipeLevel: input.recipeLevel,
    recipeFactors: input.recipeFactors,
    initialQuality: input.initialQuality,
    profile: {
      id: input.profile.id,
      level: input.profile.level,
      craftsmanship: input.profile.craftsmanship,
      control: input.profile.control,
      craftPoints: input.profile.craftPoints,
      isSpecialist: input.profile.isSpecialist,
    },
    options: {
      ...(input.options.targetQuality === undefined
        ? {}
        : { targetQuality: input.options.targetQuality }),
      useManipulation: input.options.useManipulation,
      useTrainedEye: input.options.useTrainedEye,
      backloadProgress: input.options.backloadProgress,
      adversarial: input.options.adversarial,
    },
    versions,
  })
}

export function createSolutionSnapshot(input: CreateSolutionInput): SolutionSnapshot {
  const versions = input.versions ?? currentVersions()
  return cloneJson({
    recipeId: input.recipeId,
    playerLevel: input.playerLevel,
    recipeLevel: input.recipeLevel,
    recipeFactors: input.recipeFactors,
    initialQuality: input.initialQuality,
    profile: input.profile,
    options: input.options,
    inputFingerprint: buildSolutionFingerprint({ ...input, versions }),
    response: input.response,
    macro: input.macro,
    solvedAt: input.solvedAt,
    versions,
  })
}

export function isSolutionStale(solution: SolutionSnapshot, currentFingerprint: string): boolean {
  return buildSolutionFreshnessFingerprint(solution) !== currentFingerprint
}

export function wasProfileUpdatedAfterSolution(
  profile: AttributeProfile,
  solution: SolutionSnapshot,
): boolean {
  const profileUpdatedAt = Date.parse(profile.updatedAt)
  const solvedAt = Date.parse(solution.solvedAt)
  return Number.isFinite(profileUpdatedAt) && Number.isFinite(solvedAt) && profileUpdatedAt > solvedAt
}

function requireProfile(
  state: WorkbenchState,
  job: CraftJob,
  profileId: string,
): AttributeProfile {
  const profile = state.jobs[job].profiles.find((candidate) => candidate.id === profileId)
  if (profile === undefined) throw new Error(`找不到配裝 ${profileId}。`)
  return profile
}

function validateProfile(profile: AttributeProfileInput): void {
  if (profile.name.trim().length === 0) throw new Error('配裝名稱不得為空。')
  if (!Number.isInteger(profile.level) || profile.level < 1 || profile.level > 100) {
    throw new Error('生產職業等級必須介於 1 到 100。')
  }
  if (!Number.isInteger(profile.craftsmanship) || profile.craftsmanship <= 0) {
    throw new Error('作業精度必須是大於 0 的整數。')
  }
  if (!Number.isInteger(profile.control) || profile.control <= 0) {
    throw new Error('加工精度必須是大於 0 的整數。')
  }
  if (!Number.isInteger(profile.craftPoints) || profile.craftPoints < 0) {
    throw new Error('CP 必須是大於或等於 0 的整數。')
  }
}

function validateLevel(level: number): void {
  if (!Number.isInteger(level) || level < 1 || level > 100) {
    throw new Error('生產職業目前等級必須介於 1 到 100。')
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
