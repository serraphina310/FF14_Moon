import { describe, expect, it } from 'vitest'
import { formatMacro } from '../../src/macro/format'
import { presentAction } from '../../src/macro/actions'
import { normalizeSolverFailure } from '../../src/solver/failures'
import { createSolveRequest } from '../../src/solver/request'
import type { CraftAction, RecipeLevelInput, SolverOptions } from '../../src/solver/types'

const level79: RecipeLevelInput = {
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

describe('solver request', () => {
  it('passes the complete selected RecipeLevel and recipe factors to WASM', () => {
    const request = createSolveRequest(
      { level: 79, craftsmanship: 1555, control: 1534, craftPoints: 421 },
      { difficultyFactor: 70, qualityFactor: 62, durabilityFactor: 100 },
      level79,
      options,
    )

    expect(request.recipeLevel).toEqual(level79)
    expect(request.recipeFactors).toEqual({ difficulty: 70, quality: 62, durability: 100 })
    expect(request.options.adversarial).toBe(true)
  })
})

describe('Traditional Chinese macro formatting', () => {
  it('uses safe waits and does not add /mlock by default', () => {
    expect(presentAction('innovation')).toEqual({ name: '改革', waitSeconds: 2 })
    expect(presentAction('basic_synthesis')).toEqual({ name: '製作', waitSeconds: 3 })

    const macro = formatMacro(['innovation', 'basic_synthesis'])
    expect(macro.sections[0]?.lines).toEqual([
      '/ac 改革 <wait.2>',
      '/ac 製作 <wait.3>',
      '/echo 巨集 #1 已完成！ <se.1>',
    ])
    expect(macro.sections[0]?.lines).not.toContain('/mlock')
    expect(macro.estimatedSeconds).toBe(5)
  })

  it('keeps every section within 15 lines including optional control lines', () => {
    const actions = Array.from({ length: 40 }, () => 'basic_touch' as CraftAction)
    const macro = formatMacro(actions, { includeMacroLock: true })

    expect(macro.sections).toHaveLength(4)
    expect(macro.sections.map((section) => section.actionCount)).toEqual([10, 10, 10, 10])
    expect(macro.sections.every((section) => section.lines.length <= 15)).toBe(true)
    expect(macro.sections.every((section) => section.lines[0] === '/mlock')).toBe(true)
    expect(macro.sections.reduce((total, section) => total + section.actionCount, 0)).toBe(40)
  })

  it('balances actions when the macro needs two sections', () => {
    const actions = Array.from({ length: 20 }, () => 'basic_touch' as CraftAction)
    const macro = formatMacro(actions)

    expect(macro.sections.map((section) => section.actionCount)).toEqual([10, 10])
    expect(macro.sections.map((section) => section.lines.length)).toEqual([11, 11])
  })
})

describe('typed solver failures', () => {
  it('maps Raphael no-solution and browser memory failures', () => {
    expect(normalizeSolverFailure({ code: 'no_solution', message: 'none' }).code).toBe(
      'insufficient_attributes',
    )
    expect(normalizeSolverFailure(new Error('out of memory')).code).toBe('out_of_memory')
  })
})
