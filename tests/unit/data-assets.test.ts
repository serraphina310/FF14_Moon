import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

interface AssetEntry {
  file: string
  sha256: string
  bytes: number
}

interface Manifest {
  clientBuild: string
  dataVersion: string
  recordCounts: {
    recipes: number
    recipeLevels: number
    dynamicRecipes: number
    ingredientRecipes: number
    hqIngredientRelationships: number
  }
  assets: AssetEntry[]
  fixtures: Array<{ name: string; passed: boolean }>
}

interface Recipe {
  id: number
  name: string
  recipeLevelId: number
  isExpert: boolean
}

interface RecipeLevel {
  id: number
  classJobLevel: number
  difficulty: number
  quality: number
  durability: number
}

interface DynamicManifest {
  recipeIds: number[]
  playerLevelToRecipeLevelId: Record<string, number>
}

interface IngredientData {
  schemaVersion: number
  dataVersion: string
  recipes: Array<{
    recipeId: number
    ingredients: Array<{
      slot: number
      name: string
      amount: number
      itemLevel: number
    }>
  }>
}

const dataDirectory = fileURLToPath(
  new URL('../../public/data/zh-tw-7.2/', import.meta.url),
)
const readAsset = (file: string) =>
  readFileSync(new URL(file, `file:///${dataDirectory.replaceAll('\\', '/')}/`))

describe('Patch 7.2 zh-TW generated assets', () => {
  const manifest = JSON.parse(readAsset('manifest.json').toString()) as Manifest

  it('matches every recorded asset checksum', () => {
    for (const asset of manifest.assets) {
      const bytes = readAsset(asset.file)
      expect(bytes.byteLength).toBe(asset.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256)
    }
  })

  it('keeps the audited counts and fixtures', () => {
    expect(manifest.clientBuild).toBe('2026.07.22.0000.0000')
    expect(manifest.recordCounts).toMatchObject({
      recipes: 14_409,
      recipeLevels: 800,
      dynamicRecipes: 240,
      ingredientRecipes: 8_991,
      hqIngredientRelationships: 26_568,
    })
    expect(manifest.fixtures.every((fixture) => fixture.passed)).toBe(true)
  })

  it('ships the audited HQ ingredient relationships used by the calculator', () => {
    const ingredients = JSON.parse(readAsset('ingredients.json').toString()) as IngredientData
    const whiteSteelBlade = ingredients.recipes.find((recipe) => recipe.recipeId === 111)

    expect(ingredients.schemaVersion).toBe(1)
    expect(ingredients.dataVersion).toBe(manifest.dataVersion)
    expect(whiteSteelBlade?.ingredients).toEqual([
      expect.objectContaining({ slot: 0, name: '白鋼錠', amount: 2, itemLevel: 26 }),
      expect.objectContaining({ slot: 1, name: '胡桃木材', amount: 1, itemLevel: 25 }),
      expect.objectContaining({ slot: 2, name: '粉砂岩磨刀石', amount: 1, itemLevel: 30 }),
    ])
  })

  it('separates the same-name dynamic and fixed expert recipes', () => {
    const recipes = JSON.parse(readAsset('recipes.json').toString()) as Recipe[]
    const wheel = recipes.find((recipe) => recipe.id === 36173)
    const expertWheel = recipes.find((recipe) => recipe.id === 36206)
    expect(wheel).toMatchObject({
      name: '宇宙探索用的紡車',
      recipeLevelId: 690,
      isExpert: false,
    })
    expect(expertWheel).toMatchObject({
      name: '宇宙探索用的紡車',
      recipeLevelId: 743,
      isExpert: true,
    })
  })

  it('maps Lv.79 to the complete RecipeLevel 418 fixture', () => {
    const levels = JSON.parse(
      readAsset('recipe-levels.json').toString(),
    ) as RecipeLevel[]
    const dynamic = JSON.parse(
      readAsset('dynamic-recipes.json').toString(),
    ) as DynamicManifest
    expect(dynamic.playerLevelToRecipeLevelId['79']).toBe(418)
    expect(dynamic.recipeIds).toContain(36173)
    expect(dynamic.recipeIds).not.toContain(36206)
    expect(levels.find((level) => level.id === 418)).toMatchObject({
      classJobLevel: 79,
      difficulty: 1710,
      quality: 4500,
      durability: 80,
    })
  })
})
