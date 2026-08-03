import { describe, expect, it } from 'vitest'
import {
  adoptSolution,
  createProfile,
  createSolutionSnapshot,
  createEmptyWorkbench,
  saveRecipe,
  setRecipePreferences,
} from '../../src/domain/workbench'
import { formatMacro } from '../../src/macro/format'
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
        initialQuality: 900,
        initialQualityMode: 'ingredients',
        hqIngredientAmounts: { 0: 1 },
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
        initialQuality: 900,
        initialQualityMode: 'ingredients',
        hqIngredientAmounts: { 0: 1 },
        includeMacroLock: true,
        solverOptions: { targetQuality: 2000, adversarial: false },
      })
    }
  })

  it('migrates schema 1 through the HQ ingredient preference schema', () => {
    const storage = new MemoryStorage()
    const state = createEmptyWorkbench('2026-08-03T12:00:00.000Z')
    const recipe = saveRecipe(state, 'carpenter', 36173, 79, '2026-08-03T12:00:00.000Z')
    const profile = createProfile(
      state,
      'carpenter',
      {
        name: 'Lv.79',
        level: 79,
        craftsmanship: 1555,
        control: 1534,
        craftPoints: 421,
        foodNote: '',
        medicineNote: '',
        isSpecialist: false,
      },
      'profile-a',
      '2026-08-03T12:00:00.000Z',
    )
    const solution = createSolutionSnapshot({
      recipeId: 36173,
      playerLevel: 79,
      recipeLevel: {
        id: 418,
        classJobLevel: 79,
        suggestedCraftsmanship: 1702,
        difficulty: 1710,
        quality: 4500,
        progressDivider: 109,
        qualityDivider: 89,
        progressModifier: 100,
        qualityModifier: 100,
        durability: 80,
        conditionsFlag: 15,
      },
      recipeFactors: { difficulty: 70, quality: 62, durability: 100 },
      initialQuality: 0,
      profile,
      options: {
        useManipulation: false,
        useHeartAndSoul: false,
        useQuickInnovation: false,
        useTrainedEye: false,
        backloadProgress: false,
        adversarial: false,
      },
      response: {
        actions: ['basic_synthesis'],
        simulation: {
          finalStatus: { progress: 1197, quality: 0, durability: 70, craftPoints: 421, steps: 1 },
          errors: [],
          completed: true,
          targetQualityReached: false,
          verified: true,
        },
      },
      macro: formatMacro(['basic_synthesis']),
      solvedAt: '2026-08-03T12:05:00.000Z',
    })
    adoptSolution(recipe, solution)
    const legacy = JSON.parse(JSON.stringify(state)) as Record<string, unknown>
    legacy.schemaVersion = 1
    const legacyRecipe = (legacy.jobs as typeof state.jobs).carpenter.recipes[0]
    if (legacyRecipe === undefined) throw new Error('missing legacy recipe fixture')
    delete (legacyRecipe.preferences as Partial<typeof recipe.preferences>).initialQuality
    const legacySolution = legacyRecipe.solutionsByLevel['79']
    if (legacySolution === undefined) throw new Error('missing legacy solution fixture')
    delete (legacySolution as Partial<typeof solution>).initialQuality
    storage.values.set(STORAGE_KEY, JSON.stringify(legacy))

    const loaded = loadWorkbench(storage, '2026-08-03T13:00:00.000Z')

    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.state.schemaVersion).toBe(3)
      expect(loaded.state.jobs.carpenter.recipes[0]?.preferences.initialQuality).toBe(0)
      expect(loaded.state.jobs.carpenter.recipes[0]?.preferences.initialQualityMode).toBe('manual')
      expect(loaded.state.jobs.carpenter.recipes[0]?.preferences.hqIngredientAmounts).toEqual({})
      expect(loaded.state.jobs.carpenter.recipes[0]?.solutionsByLevel['79']?.initialQuality).toBe(0)
      expect(loaded.state.jobs.carpenter.recipes[0]?.solutionsByLevel['79']?.inputFingerprint).toBe(
        solution.inputFingerprint,
      )
    }
  })

  it('migrates schema 2 preferences to manual mode without changing their value', () => {
    const storage = new MemoryStorage()
    const state = createEmptyWorkbench('2026-08-03T12:00:00.000Z')
    const recipe = saveRecipe(state, 'blacksmith', 111, 31, '2026-08-03T12:00:00.000Z')
    recipe.preferences.initialQuality = 126
    const legacy = JSON.parse(JSON.stringify(state)) as Record<string, unknown>
    legacy.schemaVersion = 2
    const legacyRecipe = (legacy.jobs as typeof state.jobs).blacksmith.recipes[0]
    if (legacyRecipe === undefined) throw new Error('missing schema 2 fixture')
    delete (legacyRecipe.preferences as Partial<typeof recipe.preferences>).initialQualityMode
    delete (legacyRecipe.preferences as Partial<typeof recipe.preferences>).hqIngredientAmounts
    storage.values.set(STORAGE_KEY, JSON.stringify(legacy))

    const loaded = loadWorkbench(storage, '2026-08-03T13:00:00.000Z')

    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.state.jobs.blacksmith.recipes[0]?.preferences).toMatchObject({
        initialQuality: 126,
        initialQualityMode: 'manual',
        hqIngredientAmounts: {},
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
