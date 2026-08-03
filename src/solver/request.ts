import type {
  CraftAttributes,
  RecipeFactors,
  RecipeLevelInput,
  SolveRequest,
  SolverOptions,
} from './types'

export interface RecipeSource {
  difficultyFactor: number
  qualityFactor: number
  durabilityFactor: number
}

export function createSolveRequest(
  attributes: CraftAttributes,
  recipe: RecipeSource,
  recipeLevel: RecipeLevelInput,
  options: SolverOptions,
): SolveRequest {
  const recipeFactors: RecipeFactors = {
    difficulty: recipe.difficultyFactor,
    quality: recipe.qualityFactor,
    durability: recipe.durabilityFactor,
  }

  return {
    attributes: { ...attributes },
    recipeLevel: { ...recipeLevel },
    recipeFactors,
    options: { ...options },
  }
}
