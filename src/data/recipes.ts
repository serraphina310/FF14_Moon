import type { RecipeLevelInput } from '../solver/types'

const DATA_ROOT = `${import.meta.env.BASE_URL}data/zh-tw-7.2`

export type CraftJob =
  | 'carpenter'
  | 'blacksmith'
  | 'armorer'
  | 'goldsmith'
  | 'leatherworker'
  | 'weaver'
  | 'alchemist'
  | 'culinarian'

export interface RecipeRecord {
  id: number
  job: CraftJob
  jobName: string
  name: string
  itemId: number
  recipeLevelId: number
  materialQualityFactor: number
  difficultyFactor: number
  qualityFactor: number
  durabilityFactor: number
  requiredQuality: number
  requiredCraftsmanship: number
  requiredControl: number
  canHq: boolean
  isExpert: boolean
  recipeNotebookList: number
}

export interface DynamicRecipeManifest {
  schemaVersion: number
  manifestVersion: string
  dataVersion: string
  recipeIds: number[]
  playerLevelToRecipeLevelId: Record<string, number>
}

export interface RecipeData {
  recipes: RecipeRecord[]
  recipeLevels: RecipeLevelInput[]
  dynamic: DynamicRecipeManifest
}

export interface ResolvedRecipeLevel {
  isDynamic: boolean
  recipeLevel: RecipeLevelInput
}

let dataPromise: Promise<RecipeData> | undefined

export function loadRecipeData(): Promise<RecipeData> {
  dataPromise ??= Promise.all([
    fetchJson<RecipeRecord[]>(`${DATA_ROOT}/recipes.json`),
    fetchJson<RecipeLevelInput[]>(`${DATA_ROOT}/recipe-levels.json`),
    fetchJson<DynamicRecipeManifest>(`${DATA_ROOT}/dynamic-recipes.json`),
  ]).then(([recipes, recipeLevels, dynamic]) => ({ recipes, recipeLevels, dynamic }))
  return dataPromise
}

export function searchRecipes(
  recipes: RecipeRecord[],
  job: CraftJob,
  query: string,
): RecipeRecord[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-TW')
  if (normalizedQuery.length === 0) return []
  return recipes.filter(
    (recipe) =>
      recipe.job === job && recipe.name.toLocaleLowerCase('zh-TW').includes(normalizedQuery),
  )
}

export function resolveRecipeLevel(
  recipe: RecipeRecord,
  playerLevel: number,
  recipeLevels: RecipeLevelInput[],
  dynamic: DynamicRecipeManifest,
): ResolvedRecipeLevel {
  const isDynamic = dynamic.recipeIds.includes(recipe.id)
  const recipeLevelId = isDynamic
    ? dynamic.playerLevelToRecipeLevelId[String(playerLevel)]
    : recipe.recipeLevelId

  if (recipeLevelId === undefined) {
    throw new Error(`找不到玩家等級 ${playerLevel} 的動態 RecipeLevel 映射。`)
  }
  const recipeLevel = recipeLevels.find((candidate) => candidate.id === recipeLevelId)
  if (recipeLevel === undefined) {
    throw new Error(`本機資料缺少 RecipeLevel ${recipeLevelId}。`)
  }
  if (isDynamic && recipeLevel.classJobLevel !== playerLevel) {
    throw new Error(
      `動態 RecipeLevel ${recipeLevel.id} 的等級 ${recipeLevel.classJobLevel} 與玩家等級 ${playerLevel} 不一致。`,
    )
  }
  return { isDynamic, recipeLevel }
}

export function calculateRecipeValues(
  recipe: RecipeRecord,
  recipeLevel: RecipeLevelInput,
): { difficulty: number; quality: number; durability: number } {
  return {
    difficulty: Math.floor((recipeLevel.difficulty * recipe.difficultyFactor) / 100),
    quality: Math.floor((recipeLevel.quality * recipe.qualityFactor) / 100),
    durability: Math.floor((recipeLevel.durability * recipe.durabilityFactor) / 100),
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`無法載入本機資料 ${url}（HTTP ${response.status}）。`)
  }
  return (await response.json()) as T
}
