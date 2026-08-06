import { describe, expect, it } from 'vitest'
import { formatMacro } from '../../src/macro/format'
import {
  adoptSolution,
  buildSolutionFreshnessFingerprint,
  buildSolutionFingerprint,
  createEmptyWorkbench,
  createProfile,
  defaultRecipePreferences,
  clearRecipeHistory,
  isSolutionStale,
  openRecipe,
  recordSolveFailure,
  removeRecipeRecord,
  retainRecipes,
  setActiveProfile,
  setJobLevel,
  setRecipePreferences,
  unretainRecipe,
  updateProfile,
  wasProfileUpdatedAfterSolution,
  type SolutionSnapshot,
} from '../../src/domain/workbench'
import type { RecipeLevelInput, SolveResponse, SolverOptions } from '../../src/solver/types'

const now = '2026-08-03T12:00:00.000Z'
const later = '2026-08-03T13:00:00.000Z'

it('keeps optional solver capabilities off for new recipes until the user opts in', () => {
  const options = defaultRecipePreferences().solverOptions
  expect(options.useManipulation).toBe(false)
  expect(options.adversarial).toBe(false)
})

const recipeLevel: RecipeLevelInput = {
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
}

const options: SolverOptions = {
  useManipulation: true,
  useHeartAndSoul: false,
  useQuickInnovation: false,
  useTrainedEye: false,
  backloadProgress: false,
  adversarial: true,
}

const response: SolveResponse = {
  actions: ['veneration', 'groundwork'],
  simulation: {
    finalStatus: { progress: 1197, quality: 2790, durability: 0, craftPoints: 109, steps: 2 },
    errors: [],
    completed: true,
    targetQualityReached: true,
    verified: true,
  },
}

describe('job workspaces and recipe identity', () => {
  it('keeps first-query order when an existing recipe is reopened', () => {
    const state = createEmptyWorkbench(now)
    expect(Object.keys(state.jobs)).toHaveLength(8)

    const first = openRecipe(state, 'carpenter', 36173, now)
    openRecipe(state, 'carpenter', 36178, '2026-08-03T12:30:00.000Z')
    const reopened = openRecipe(state, 'carpenter', 36173, later)
    openRecipe(state, 'weaver', 36300, now)

    expect(reopened).toBe(first)
    expect(reopened.lastViewedAt).toBe(later)
    expect(state.jobs.carpenter.historyRecipeIds).toEqual([36173, 36178])
    expect(state.jobs.carpenter.recipes).toHaveLength(2)
    expect(state.jobs.weaver.recipes).toHaveLength(1)
  })

  it('keeps retained recipes separate from history and never deletes records implicitly', () => {
    const state = createEmptyWorkbench(now)
    openRecipe(state, 'carpenter', 36173, now)
    openRecipe(state, 'carpenter', 36178, later)

    retainRecipes(state, 'carpenter', [36178, 36173, 36178], later)
    expect(state.jobs.carpenter.retainedRecipeIds).toEqual([36178, 36173])

    unretainRecipe(state, 'carpenter', 36178, later)
    expect(state.jobs.carpenter.retainedRecipeIds).toEqual([36173])
    expect(state.jobs.carpenter.historyRecipeIds).toEqual([36173, 36178])
    expect(state.jobs.carpenter.recipes).toHaveLength(2)

    clearRecipeHistory(state, 'carpenter', later)
    expect(state.jobs.carpenter.historyRecipeIds).toEqual([])
    expect(state.jobs.carpenter.retainedRecipeIds).toEqual([36173])
    expect(state.jobs.carpenter.recipes).toHaveLength(2)

    removeRecipeRecord(state, 'carpenter', 36173, later)
    expect(state.jobs.carpenter.retainedRecipeIds).toEqual([])
    expect(state.jobs.carpenter.recipes.map((recipe) => recipe.recipeId)).toEqual([36178])
  })

  it('stores one current level per job without changing the active profile', () => {
    const state = createEmptyWorkbench(now)
    const level79 = createProfile(
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
      'profile-79',
      now,
    )
    createProfile(
      state,
      'carpenter',
      { ...level79, name: 'Lv.80', level: 80 },
      'profile-80',
      now,
    )

    setJobLevel(state, 'carpenter', 80, later)
    expect(state.jobs.carpenter.currentLevel).toBe(80)
    expect(state.jobs.carpenter.activeProfileId).toBe('profile-79')

    setJobLevel(state, 'carpenter', 81, later)
    expect(state.jobs.carpenter.currentLevel).toBe(81)
    expect(state.jobs.carpenter.activeProfileId).toBe('profile-79')
  })

  it('rejects a non-integer initial-quality preference', () => {
    const state = createEmptyWorkbench(now)
    const record = openRecipe(state, 'carpenter', 36173, now)

    expect(() =>
      setRecipePreferences(
        record,
        { ...record.preferences, initialQuality: 0.5 },
        later,
      ),
    ).toThrow('初期品質')
    expect(record.preferences.initialQuality).toBe(0)
  })

  it('rejects invalid persisted HQ ingredient counts', () => {
    const state = createEmptyWorkbench(now)
    const record = openRecipe(state, 'blacksmith', 111, now)

    expect(() =>
      setRecipePreferences(
        record,
        {
          ...record.preferences,
          initialQualityMode: 'ingredients',
          hqIngredientAmounts: { 0: -1 },
        },
        later,
      ),
    ).toThrow('HQ 素材數量')
  })
})

describe('profiles, fingerprints, and solution replacement', () => {
  it('marks answers stale after effective profile edits and switches', () => {
    const state = createEmptyWorkbench(now)
    const profileA = createProfile(
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
      'profile-a',
      now,
    )
    const profileB = createProfile(
      state,
      'carpenter',
      { ...profileA, name: '備用', craftsmanship: 1600, isSpecialist: true },
      'profile-b',
      now,
    )
    setActiveProfile(state, 'carpenter', profileA.id, now)

    const input = {
      recipeId: 36173,
      playerLevel: 79,
      recipeLevel,
      recipeFactors: { difficulty: 70, quality: 62, durability: 100 },
      initialQuality: 0,
      profile: profileA,
      options,
    }
    const fingerprint = buildSolutionFingerprint(input)
    const freshnessFingerprint = buildSolutionFreshnessFingerprint(input)
    const solution = makeSolution(fingerprint, profileA)
    expect(isSolutionStale(solution, freshnessFingerprint)).toBe(false)

    const edited = updateProfile(
      state,
      'carpenter',
      profileA.id,
      { craftsmanship: 1556 },
      later,
    )
    const editedFingerprint = buildSolutionFreshnessFingerprint({
      ...input,
      profile: edited,
    })
    expect(editedFingerprint).not.toBe(freshnessFingerprint)
    expect(isSolutionStale(solution, editedFingerprint)).toBe(true)

    setActiveProfile(state, 'carpenter', profileB.id, later)
    const switchedFingerprint = buildSolutionFreshnessFingerprint({
      ...input,
      profile: profileB,
      options: { ...options, useHeartAndSoul: true, useQuickInnovation: true },
    })
    expect(switchedFingerprint).not.toBe(freshnessFingerprint)
    expect(isSolutionStale(solution, switchedFingerprint)).toBe(true)

    const optionFingerprint = buildSolutionFreshnessFingerprint({
      ...input,
      options: { ...options, adversarial: false },
    })
    const versionFingerprint = buildSolutionFreshnessFingerprint({
      ...input,
      versions: { app: '0.0.0', data: 'new-data', solver: 'new-solver' },
    })
    expect(isSolutionStale(solution, optionFingerprint)).toBe(true)
    expect(isSolutionStale(solution, versionFingerprint)).toBe(true)

    const initialQualityFingerprint = buildSolutionFreshnessFingerprint({
      ...input,
      initialQuality: 500,
    })
    expect(isSolutionStale(solution, initialQualityFingerprint)).toBe(true)
  })

  it('keeps freshness independent from the legacy level stored on a profile', () => {
    const state = createEmptyWorkbench(now)
    const profile = createProfile(
      state,
      'carpenter',
      {
        name: '跨等級配裝',
        level: 100,
        craftsmanship: 1555,
        control: 1534,
        craftPoints: 421,
        foodNote: '',
        medicineNote: '',
        isSpecialist: false,
      },
      'profile-a',
      now,
    )
    const input = {
      recipeId: 36173,
      playerLevel: 79,
      recipeLevel,
      recipeFactors: { difficulty: 70, quality: 62, durability: 100 },
      initialQuality: 0,
      profile,
      options,
    }
    const solution = makeSolution(buildSolutionFingerprint(input), profile)
    const currentFingerprint = buildSolutionFreshnessFingerprint({
      ...input,
      profile: { ...profile, level: 79 },
    })

    expect(isSolutionStale(solution, currentFingerprint)).toBe(false)
  })

  it('reports equipment updates only when the profile changed after solving', () => {
    const state = createEmptyWorkbench(now)
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
      'profile-a',
      now,
    )
    const solution = makeSolution('fingerprint', profile)

    expect(wasProfileUpdatedAfterSolution(profile, solution)).toBe(false)
    const updated = updateProfile(state, 'carpenter', profile.id, { craftsmanship: 1556 }, later)
    expect(wasProfileUpdatedAfterSolution(updated, solution)).toBe(true)
    expect(wasProfileUpdatedAfterSolution(updated, { ...solution, solvedAt: later })).toBe(false)
  })

  it('keeps one successful solution per level and failures never replace it', () => {
    const state = createEmptyWorkbench(now)
    const profile = createProfile(
      state,
      'carpenter',
      {
        name: '預設',
        level: 79,
        craftsmanship: 1555,
        control: 1534,
        craftPoints: 421,
        foodNote: '',
        medicineNote: '',
        isSpecialist: false,
      },
      'profile-a',
      now,
    )
    const record = openRecipe(state, 'carpenter', 36173, now)
    const first = makeSolution('first', profile)
    const replacement = { ...makeSolution('replacement', profile), solvedAt: later }

    setJobLevel(state, 'carpenter', 79, now)
    adoptSolution(record, first, state.jobs.carpenter.currentLevel)
    recordSolveFailure(
      record,
      { code: 'insufficient_attributes', message: '找不到解答。' },
      later,
    )
    expect(record.solutionsByLevel['79']).toEqual(first)
    expect(record.solutionsByLevel['79']).not.toBe(first)
    expect(record.latestSolveError?.code).toBe('insufficient_attributes')

    adoptSolution(record, replacement, state.jobs.carpenter.currentLevel)
    expect(record.solutionsByLevel['79']).toEqual(replacement)
    expect(record.solutionsByLevel['79']).not.toBe(replacement)
    expect(record.latestSolveError).toBeUndefined()

    setJobLevel(state, 'carpenter', 80, later)
    const level80 = {
      ...makeSolution('level-80', profile),
      playerLevel: 80,
      solvedAt: later,
    }
    adoptSolution(record, level80, state.jobs.carpenter.currentLevel)
    expect(Object.keys(record.solutionsByLevel)).toEqual(['79', '80'])
  })
})

function makeSolution(fingerprint: string, profile: ReturnType<typeof createProfile>): SolutionSnapshot {
  return {
    recipeId: 36173,
    playerLevel: 79,
    recipeLevel: { ...recipeLevel },
    recipeFactors: { difficulty: 70, quality: 62, durability: 100 },
    initialQuality: 0,
    profile: { ...profile },
    options: { ...options },
    inputFingerprint: fingerprint,
    response,
    macro: formatMacro(response.actions),
    solvedAt: now,
    versions: {
      app: '0.0.0',
      data: 'zh-tw-7.2-2026.07.22.0000.0000.2',
      solver: 'raphael-v0.25.3-9ec209b4',
    },
  }
}
