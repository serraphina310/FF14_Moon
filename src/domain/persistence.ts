import {
  CRAFT_JOBS,
  buildSolutionFingerprint,
  createEmptyWorkbench,
  type WorkbenchState,
} from './workbench'
import { WORKBENCH_SCHEMA_VERSION } from './versions'

export const STORAGE_KEY = 'ff14-moon:workbench'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type StorageErrorCode =
  | 'unavailable'
  | 'corrupt'
  | 'unsupported_schema'
  | 'quota'
  | 'write_failed'

export interface StorageError {
  code: StorageErrorCode
  message: string
  detail?: string
  raw?: string
}

export type LoadWorkbenchResult =
  | { ok: true; state: WorkbenchState; source: 'empty' | 'stored' }
  | { ok: false; error: StorageError; fallback: WorkbenchState }

export type StorageOperationResult = { ok: true } | { ok: false; error: StorageError }

export function loadWorkbench(storage: StorageLike, now: string): LoadWorkbenchResult {
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch (error) {
    return loadFailure('unavailable', '瀏覽器不允許讀取本機資料。', now, error)
  }
  if (raw === null) return { ok: true, state: createEmptyWorkbench(now), source: 'empty' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return loadFailure('corrupt', '已保存的本機資料不是有效 JSON，原始內容未被覆寫。', now, error, raw)
  }

  if (!isRecord(parsed) || typeof parsed.schemaVersion !== 'number') {
    return loadFailure('corrupt', '已保存的本機資料缺少 schema version，原始內容未被覆寫。', now, undefined, raw)
  }
  const migrated = migrateWorkbench(parsed)
  if (migrated.schemaVersion !== WORKBENCH_SCHEMA_VERSION) {
    return loadFailure(
      'unsupported_schema',
      `本機資料 schema ${parsed.schemaVersion} 不受目前版本支援，資料未被降版或覆寫。`,
      now,
      undefined,
      raw,
    )
  }
  if (!isWorkbenchState(migrated)) {
    return loadFailure('corrupt', '已保存的本機資料結構不完整，原始內容未被覆寫。', now, undefined, raw)
  }
  return { ok: true, state: migrated, source: 'stored' }
}

function migrateWorkbench(value: Record<string, unknown>): Record<string, unknown> {
  const migrated = JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  if (migrated.schemaVersion === 1) {
    if (isRecord(migrated.jobs)) {
      for (const workspace of Object.values(migrated.jobs)) {
        if (!isRecord(workspace) || !Array.isArray(workspace.recipes)) continue
        for (const recipe of workspace.recipes) {
          if (!isRecord(recipe)) continue
          if (isRecord(recipe.preferences) && recipe.preferences.initialQuality === undefined) {
            recipe.preferences.initialQuality = 0
          }
          if (!isRecord(recipe.solutionsByLevel)) continue
          for (const solution of Object.values(recipe.solutionsByLevel)) {
            if (isRecord(solution) && solution.initialQuality === undefined) {
              solution.initialQuality = 0
            }
          }
        }
      }
    }
    migrated.schemaVersion = 2
  }

  if (migrated.schemaVersion === 2) {
    if (isRecord(migrated.jobs)) {
      for (const workspace of Object.values(migrated.jobs)) {
        if (!isRecord(workspace) || !Array.isArray(workspace.recipes)) continue
        for (const recipe of workspace.recipes) {
          if (!isRecord(recipe) || !isRecord(recipe.preferences)) continue
          recipe.preferences.initialQualityMode = 'manual'
          recipe.preferences.hqIngredientAmounts = {}
        }
      }
    }
    migrated.schemaVersion = WORKBENCH_SCHEMA_VERSION
  }

  if (isWorkbenchState(migrated)) {
    for (const job of CRAFT_JOBS) {
      for (const recipe of migrated.jobs[job].recipes) {
        for (const solution of Object.values(recipe.solutionsByLevel)) {
          solution.inputFingerprint = buildSolutionFingerprint(solution)
        }
      }
    }
  }
  return migrated
}

export function saveWorkbench(
  storage: StorageLike,
  state: WorkbenchState,
): StorageOperationResult {
  const serialized = JSON.stringify(state)
  try {
    storage.setItem(STORAGE_KEY, serialized)
    if (storage.getItem(STORAGE_KEY) !== serialized) {
      return operationFailure('write_failed', '本機資料寫入後驗證失敗。')
    }
    return { ok: true }
  } catch (error) {
    if (isQuotaError(error)) {
      return operationFailure('quota', '瀏覽器本機儲存空間不足，變更尚未保存。', error)
    }
    return operationFailure('write_failed', '無法保存本機資料。', error)
  }
}

export function clearWorkbench(storage: StorageLike): StorageOperationResult {
  try {
    storage.removeItem(STORAGE_KEY)
    if (storage.getItem(STORAGE_KEY) !== null) {
      return operationFailure('write_failed', '本機資料清除後驗證失敗。')
    }
    return { ok: true }
  } catch (error) {
    return operationFailure('write_failed', '無法清除應用程式的本機資料。', error)
  }
}

function isWorkbenchState(value: Record<string, unknown>): value is WorkbenchState {
  if (
    value.schemaVersion !== WORKBENCH_SCHEMA_VERSION ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string' ||
    !isVersionSnapshot(value.versions) ||
    !isRecord(value.jobs)
  ) {
    return false
  }
  return CRAFT_JOBS.every((job) => {
    const workspace = value.jobs[job]
    if (
      !isRecord(workspace) ||
      !Array.isArray(workspace.recipes) ||
      !workspace.recipes.every(isSavedRecipe) ||
      !hasUniqueNumbers(workspace.recipes, 'recipeId') ||
      !Array.isArray(workspace.profiles) ||
      !workspace.profiles.every(isProfile) ||
      !hasUniqueStrings(workspace.profiles, 'id') ||
      (workspace.activeProfileId !== undefined && typeof workspace.activeProfileId !== 'string')
    ) {
      return false
    }
    return (
      workspace.activeProfileId === undefined ||
      workspace.profiles.some((profile) => profile.id === workspace.activeProfileId)
    )
  })
}

function isSavedRecipe(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.recipeId === 'number' &&
    typeof value.currentLevel === 'number' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.lastViewedAt === 'string' &&
    isRecipePreferences(value.preferences) &&
    isRecord(value.solutionsByLevel) &&
    Object.values(value.solutionsByLevel).every(isSolutionSnapshot)
  )
}

function isRecipePreferences(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.initialQuality === 'number' &&
    Number.isInteger(value.initialQuality) &&
    value.initialQuality >= 0 &&
    (value.initialQualityMode === 'manual' || value.initialQualityMode === 'ingredients') &&
    isRecord(value.hqIngredientAmounts) &&
    Object.entries(value.hqIngredientAmounts).every(
      ([slot, amount]) => /^\d+$/.test(slot) && typeof amount === 'number' && Number.isInteger(amount) && amount >= 0,
    ) &&
    typeof value.includeMacroLock === 'boolean' &&
    isRecord(value.solverOptions) &&
    typeof value.solverOptions.useManipulation === 'boolean' &&
    typeof value.solverOptions.useHeartAndSoul === 'boolean' &&
    typeof value.solverOptions.useQuickInnovation === 'boolean' &&
    typeof value.solverOptions.useTrainedEye === 'boolean' &&
    typeof value.solverOptions.backloadProgress === 'boolean' &&
    typeof value.solverOptions.adversarial === 'boolean' &&
    (value.solverOptions.targetQuality === undefined ||
      typeof value.solverOptions.targetQuality === 'number')
  )
}

function isSolutionSnapshot(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.recipeId === 'number' &&
    typeof value.playerLevel === 'number' &&
    isRecord(value.recipeLevel) &&
    isRecord(value.recipeFactors) &&
    typeof value.initialQuality === 'number' &&
    Number.isInteger(value.initialQuality) &&
    value.initialQuality >= 0 &&
    isProfile(value.profile) &&
    isRecord(value.options) &&
    typeof value.inputFingerprint === 'string' &&
    isRecord(value.response) &&
    Array.isArray(value.response.actions) &&
    isRecord(value.response.simulation) &&
    typeof value.response.simulation.verified === 'boolean' &&
    isRecord(value.macro) &&
    Array.isArray(value.macro.sections) &&
    typeof value.solvedAt === 'string' &&
    isVersionSnapshot(value.versions)
  )
}

function isProfile(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.level === 'number' &&
    typeof value.craftsmanship === 'number' &&
    typeof value.control === 'number' &&
    typeof value.craftPoints === 'number' &&
    typeof value.foodNote === 'string' &&
    typeof value.medicineNote === 'string' &&
    typeof value.isSpecialist === 'boolean' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isVersionSnapshot(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.app === 'string' &&
    typeof value.data === 'string' &&
    typeof value.solver === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasUniqueNumbers(values: unknown[], key: string): boolean {
  const entries = values.map((value) => (isRecord(value) ? value[key] : undefined))
  return entries.every((entry) => typeof entry === 'number') && new Set(entries).size === entries.length
}

function hasUniqueStrings(values: unknown[], key: string): boolean {
  const entries = values.map((value) => (isRecord(value) ? value[key] : undefined))
  return entries.every((entry) => typeof entry === 'string') && new Set(entries).size === entries.length
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

function loadFailure(
  code: StorageErrorCode,
  message: string,
  now: string,
  error?: unknown,
  raw?: string,
): LoadWorkbenchResult {
  const detail = error === undefined ? undefined : String(error)
  return {
    ok: false,
    error: {
      code,
      message,
      ...(detail === undefined ? {} : { detail }),
      ...(raw === undefined ? {} : { raw }),
    },
    fallback: createEmptyWorkbench(now),
  }
}

function operationFailure(
  code: StorageErrorCode,
  message: string,
  error?: unknown,
): StorageOperationResult {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(error === undefined ? {} : { detail: String(error) }),
    },
  }
}
