import { describe, expect, it } from 'vitest'
import { formatMacro } from '../../src/macro/format'
import {
  adoptSolution,
  buildSolutionFingerprint,
  createEmptyWorkbench,
  createProfile,
  defaultRecipePreferences,
  isSolutionStale,
  recordSolveFailure,
  removeSavedRecipe,
  saveRecipe,
  setActiveProfile,
  setSavedRecipeLevel,
  updateProfile,
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
  it('keeps eight job collections independent and deduplicates by recipe ID within a job', () => {
    const state = createEmptyWorkbench(now)
    expect(Object.keys(state.jobs)).toHaveLength(8)

    const first = saveRecipe(state, 'carpenter', 36173, 79, now)
    const reopened = saveRecipe(state, 'carpenter', 36173, 80, later)
    saveRecipe(state, 'weaver', 36300, 79, now)

    expect(reopened).toBe(first)
    expect(reopened.currentLevel).toBe(79)
    expect(reopened.lastViewedAt).toBe(later)
    expect(state.jobs.carpenter.recipes).toHaveLength(1)
    expect(state.jobs.weaver.recipes).toHaveLength(1)

    removeSavedRecipe(state, 'carpenter', 36173, later)
    expect(state.jobs.carpenter.recipes).toHaveLength(0)
    expect(state.jobs.weaver.recipes).toHaveLength(1)
  })
})

describe('profiles, fingerprints, and solution replacement', () => {
  it('marks snapshots stale after profile edits or active-profile switches', () => {
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
      { ...profileA, name: '備用', craftsmanship: 1600 },
      'profile-b',
      now,
    )
    setActiveProfile(state, 'carpenter', profileA.id, now)

    const fingerprint = buildSolutionFingerprint({
      recipeId: 36173,
      playerLevel: 79,
      recipeLevel,
      recipeFactors: { difficulty: 70, quality: 62, durability: 100 },
      profile: profileA,
      options,
    })
    const solution = makeSolution(fingerprint, profileA)
    expect(isSolutionStale(solution, fingerprint)).toBe(false)

    const edited = updateProfile(
      state,
      'carpenter',
      profileA.id,
      { craftsmanship: 1556 },
      later,
    )
    const editedFingerprint = buildSolutionFingerprint({
      recipeId: 36173,
      playerLevel: 79,
      recipeLevel,
      recipeFactors: { difficulty: 70, quality: 62, durability: 100 },
      profile: edited,
      options,
    })
    expect(isSolutionStale(solution, editedFingerprint)).toBe(true)

    setActiveProfile(state, 'carpenter', profileB.id, later)
    const switchedFingerprint = buildSolutionFingerprint({
      recipeId: 36173,
      playerLevel: 79,
      recipeLevel,
      recipeFactors: { difficulty: 70, quality: 62, durability: 100 },
      profile: profileB,
      options,
    })
    expect(isSolutionStale(solution, switchedFingerprint)).toBe(true)

    const optionFingerprint = buildSolutionFingerprint({
      recipeId: 36173,
      playerLevel: 79,
      recipeLevel,
      recipeFactors: { difficulty: 70, quality: 62, durability: 100 },
      profile: profileA,
      options: { ...options, adversarial: false },
    })
    const versionFingerprint = buildSolutionFingerprint({
      recipeId: 36173,
      playerLevel: 79,
      recipeLevel,
      recipeFactors: { difficulty: 70, quality: 62, durability: 100 },
      profile: profileA,
      options,
      versions: { app: '0.0.0', data: 'new-data', solver: 'new-solver' },
    })
    expect(optionFingerprint).not.toBe(fingerprint)
    expect(versionFingerprint).not.toBe(fingerprint)
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
    const record = saveRecipe(state, 'carpenter', 36173, 79, now)
    const first = makeSolution('first', profile)
    const replacement = { ...makeSolution('replacement', profile), solvedAt: later }

    adoptSolution(record, first)
    recordSolveFailure(
      record,
      { code: 'insufficient_attributes', message: '找不到解答。' },
      later,
    )
    expect(record.solutionsByLevel['79']).toEqual(first)
    expect(record.solutionsByLevel['79']).not.toBe(first)
    expect(record.latestSolveError?.code).toBe('insufficient_attributes')

    adoptSolution(record, replacement)
    expect(record.solutionsByLevel['79']).toEqual(replacement)
    expect(record.solutionsByLevel['79']).not.toBe(replacement)
    expect(record.latestSolveError).toBeUndefined()

    setSavedRecipeLevel(record, 80, later)
    const level80 = {
      ...makeSolution('level-80', profile),
      playerLevel: 80,
      solvedAt: later,
    }
    adoptSolution(record, level80)
    expect(Object.keys(record.solutionsByLevel)).toEqual(['79', '80'])
  })
})

function makeSolution(fingerprint: string, profile: ReturnType<typeof createProfile>): SolutionSnapshot {
  return {
    recipeId: 36173,
    playerLevel: 79,
    recipeLevel: { ...recipeLevel },
    recipeFactors: { difficulty: 70, quality: 62, durability: 100 },
    profile: { ...profile },
    options: { ...options },
    inputFingerprint: fingerprint,
    response,
    macro: formatMacro(response.actions),
    solvedAt: now,
    versions: {
      app: '0.0.0',
      data: 'zh-tw-7.2-2026.07.22.0000.0000.1',
      solver: 'raphael-v0.25.3-9ec209b4',
    },
  }
}
