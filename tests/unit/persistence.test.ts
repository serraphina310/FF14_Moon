import { describe, expect, it } from 'vitest'
import {
  createEmptyWorkbench,
  saveRecipe,
  setRecipePreferences,
} from '../../src/domain/workbench'
import {
  STORAGE_KEY,
  clearWorkbench,
  loadWorkbench,
  saveWorkbench,
  type StorageLike,
} from '../../src/domain/persistence'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  failWrites = false

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException('quota', 'QuotaExceededError')
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

describe('versioned localStorage persistence', () => {
  it('round-trips all job state across a reload', () => {
    const storage = new MemoryStorage()
    const state = createEmptyWorkbench('2026-08-03T12:00:00.000Z')
    const recipe = saveRecipe(state, 'carpenter', 36173, 79, '2026-08-03T12:00:00.000Z')
    setRecipePreferences(
      recipe,
      {
        solverOptions: {
          targetQuality: 2000,
          useManipulation: true,
          useHeartAndSoul: false,
          useQuickInnovation: false,
          useTrainedEye: false,
          backloadProgress: false,
          adversarial: false,
        },
        includeMacroLock: true,
      },
      '2026-08-03T12:05:00.000Z',
    )

    expect(saveWorkbench(storage, state)).toEqual({ ok: true })
    const loaded = loadWorkbench(storage, '2026-08-03T13:00:00.000Z')
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.state.jobs.carpenter.recipes[0]?.recipeId).toBe(36173)
      expect(loaded.state.jobs.carpenter.recipes[0]?.preferences).toMatchObject({
        includeMacroLock: true,
        solverOptions: { targetQuality: 2000, adversarial: false },
      })
    }
  })

  it('does not overwrite corrupt or future-schema data', () => {
    const corruptStorage = new MemoryStorage()
    corruptStorage.values.set(STORAGE_KEY, '{broken')
    const corrupt = loadWorkbench(corruptStorage, '2026-08-03T12:00:00.000Z')
    expect(corrupt).toMatchObject({ ok: false, error: { code: 'corrupt' } })
    expect(corruptStorage.getItem(STORAGE_KEY)).toBe('{broken')

    const futureStorage = new MemoryStorage()
    const future = JSON.stringify({ schemaVersion: 999, jobs: {} })
    futureStorage.values.set(STORAGE_KEY, future)
    const unsupported = loadWorkbench(futureStorage, '2026-08-03T12:00:00.000Z')
    expect(unsupported).toMatchObject({ ok: false, error: { code: 'unsupported_schema' } })
    expect(futureStorage.getItem(STORAGE_KEY)).toBe(future)
  })

  it('reports quota failures and clears only the application key', () => {
    const storage = new MemoryStorage()
    storage.values.set('unrelated', 'keep')
    storage.failWrites = true
    expect(saveWorkbench(storage, createEmptyWorkbench('2026-08-03T12:00:00.000Z'))).toMatchObject({
      ok: false,
      error: { code: 'quota' },
    })

    storage.failWrites = false
    storage.values.set(STORAGE_KEY, '{}')
    expect(clearWorkbench(storage)).toEqual({ ok: true })
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(storage.getItem('unrelated')).toBe('keep')
  })
})
