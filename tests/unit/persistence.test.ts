import { describe, expect, it } from 'vitest'
import {
  adoptSolution,
  createProfile,
  createSolutionSnapshot,
  createEmptyWorkbench,
  openRecipe,
  retainRecipes,
  setJobLevel,
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
    setJobLevel(state, 'carpenter', 79, '2026-08-03T12:00:00.000Z')
    const recipe = openRecipe(state, 'carpenter', 36173, '2026-08-03T12:00:00.000Z')
    retainRecipes(state, 'carpenter', [36173], '2026-08-03T12:00:00.000Z')
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
      expect(loaded.state.jobs.carpenter.currentLevel).toBe(79)
      expect(loaded.state.jobs.carpenter.historyRecipeIds).toEqual([36173])
      expect(loaded.state.jobs.carpenter.retainedRecipeIds).toEqual([36173])
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
    const recipe = openRecipe(state, 'carpenter', 36173, '2026-08-03T12:00:00.000Z')
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
    setJobLevel(state, 'carpenter', 79, '2026-08-03T12:00:00.000Z')
    adoptSolution(recipe, solution, 79)
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
      expect(loaded.state.schemaVersion).toBe(4)
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
    const recipe = openRecipe(state, 'blacksmith', 111, '2026-08-03T12:00:00.000Z')
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

  it('migrates schema 3 records into stable history without assuming they were retained', () => {
    const storage = new MemoryStorage()
    const state = createEmptyWorkbench('2026-08-03T12:00:00.000Z')
    const profile = createProfile(
      state,
      'carpenter',
      {
        name: '遊戲畫面',
        level: 79,
        craftsmanship: 1555,
        control: 1534,
        craftPoints: 421,
        foodNote: '',
        medicineNote: '',
        isSpecialist: false,
      },
      'profile-79',
      '2026-08-03T12:00:00.000Z',
    )
    const first = openRecipe(state, 'carpenter', 36173, '2026-08-03T12:00:00.000Z')
    const second = openRecipe(state, 'carpenter', 36178, '2026-08-03T12:05:00.000Z')
    const legacy = JSON.parse(JSON.stringify(state)) as Record<string, unknown>
    legacy.schemaVersion = 3
    const jobs = legacy.jobs as typeof state.jobs
    for (const workspace of Object.values(jobs)) {
      delete (workspace as Partial<typeof workspace>).currentLevel
      delete (workspace as Partial<typeof workspace>).historyRecipeIds
      delete (workspace as Partial<typeof workspace>).retainedRecipeIds
      for (const recipe of workspace.recipes) {
        const legacyRecipe = recipe as typeof recipe & { currentLevel: number }
        legacyRecipe.currentLevel = recipe.recipeId === 36173 ? 79 : 80
      }
    }
    jobs.carpenter.activeProfileId = profile.id
    storage.values.set(STORAGE_KEY, JSON.stringify(legacy))

    const loaded = loadWorkbench(storage, '2026-08-03T13:00:00.000Z')

    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.state.schemaVersion).toBe(4)
      expect(loaded.state.jobs.carpenter.currentLevel).toBe(79)
      expect(loaded.state.jobs.carpenter.historyRecipeIds).toEqual([first.recipeId, second.recipeId])
      expect(loaded.state.jobs.carpenter.retainedRecipeIds).toEqual([])
      expect(loaded.state.jobs.carpenter.recipes[0]).not.toHaveProperty('currentLevel')
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
