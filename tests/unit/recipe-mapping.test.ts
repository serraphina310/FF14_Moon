import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  calculateRecipeValues,
  resolveRecipeLevel,
  searchRecipes,
  type DynamicRecipeManifest,
  type RecipeRecord,
} from '../../src/data/recipes'
import type { RecipeLevelInput } from '../../src/solver/types'

const readAsset = <T>(file: string): T =>
  JSON.parse(
    readFileSync(new URL(`../../public/data/zh-tw-7.2/${file}`, import.meta.url), 'utf8'),
  ) as T

const recipes = readAsset<RecipeRecord[]>('recipes.json')
const recipeLevels = readAsset<RecipeLevelInput[]>('recipe-levels.json')
const dynamic = readAsset<DynamicRecipeManifest>('dynamic-recipes.json')

describe('audited dynamic RecipeLevel mapping', () => {
  it('finds both same-name Carpenter recipes but keeps their identities distinct', () => {
    const matches = searchRecipes(recipes, 'carpenter', '宇宙探索用的紡車')
    expect(matches.map((recipe) => recipe.id)).toEqual(expect.arrayContaining([36173, 36206]))
  })

  it('maps the dynamic wheel to Lv.79 RecipeLevel 418 without changing the fixed expert recipe', () => {
    const dynamicWheel = recipes.find((recipe) => recipe.id === 36173)
    const expertWheel = recipes.find((recipe) => recipe.id === 36206)
    expect(dynamicWheel).toBeDefined()
    expect(expertWheel).toBeDefined()

    const dynamicResult = resolveRecipeLevel(dynamicWheel!, 79, recipeLevels, dynamic)
    const fixedResult = resolveRecipeLevel(expertWheel!, 79, recipeLevels, dynamic)
    expect(dynamicResult).toMatchObject({ isDynamic: true, recipeLevel: { id: 418 } })
    expect(fixedResult).toMatchObject({ isDynamic: false, recipeLevel: { id: 743 } })
  })

  it('reproduces the in-game sap values and rejects an unsupported dynamic level', () => {
    const sap = recipes.find((recipe) => recipe.id === 36178)
    expect(sap).toBeDefined()
    const resolved = resolveRecipeLevel(sap!, 79, recipeLevels, dynamic)
    expect(calculateRecipeValues(sap!, resolved.recipeLevel)).toEqual({
      difficulty: 1060,
      quality: 2250,
      durability: 40,
    })
    expect(() => resolveRecipeLevel(sap!, 9, recipeLevels, dynamic)).toThrow(
      '找不到玩家等級 9 的動態 RecipeLevel 映射',
    )
  })
})
