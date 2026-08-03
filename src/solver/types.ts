export type CraftAction =
  | 'basic_synthesis'
  | 'basic_touch'
  | 'masters_mend'
  | 'hasty_touch'
  | 'rapid_synthesis'
  | 'observe'
  | 'tricks_of_the_trade'
  | 'waste_not'
  | 'veneration'
  | 'standard_touch'
  | 'great_strides'
  | 'innovation'
  | 'final_appraisal'
  | 'waste_not_ii'
  | 'byregot_s_blessing'
  | 'precise_touch'
  | 'muscle_memory'
  | 'careful_synthesis'
  | 'manipulation'
  | 'prudent_touch'
  | 'advanced_touch'
  | 'reflect'
  | 'preparatory_touch'
  | 'groundwork'
  | 'delicate_synthesis'
  | 'intensive_synthesis'
  | 'trained_eye'
  | 'prudent_synthesis'
  | 'trained_finesse'
  | 'careful_observation'
  | 'heart_and_soul'
  | 'refined_touch'
  | 'daring_touch'
  | 'quick_innovation'
  | 'immaculate_mend'
  | 'trained_perfection'

export interface CraftAttributes {
  level: number
  craftsmanship: number
  control: number
  craftPoints: number
}

export interface RecipeLevelInput {
  id: number
  classJobLevel: number
  suggestedCraftsmanship: number
  difficulty: number
  quality: number
  progressDivider: number
  qualityDivider: number
  progressModifier: number
  qualityModifier: number
  durability: number
  conditionsFlag: number
}

export interface RecipeFactors {
  difficulty: number
  quality: number
  durability: number
}

export interface SolverOptions {
  targetQuality?: number
  useManipulation: boolean
  useHeartAndSoul: boolean
  useQuickInnovation: boolean
  useTrainedEye: boolean
  backloadProgress: boolean
  adversarial: boolean
}

export interface SolveRequest {
  attributes: CraftAttributes
  recipeLevel: RecipeLevelInput
  recipeFactors: RecipeFactors
  initialQuality: number
  options: SolverOptions
}

export interface FinalStatus {
  progress: number
  quality: number
  durability: number
  craftPoints: number
  steps: number
}

export interface SimulationError {
  actionIndex: number
  action: CraftAction
  message: string
}

export interface SimulationResponse {
  finalStatus: FinalStatus
  errors: SimulationError[]
  completed: boolean
  targetQualityReached: boolean
  verified: boolean
}

export interface SolveResponse {
  actions: CraftAction[]
  simulation: SimulationResponse
}

export type SolverFailureCode =
  | 'cancelled'
  | 'insufficient_attributes'
  | 'recipe_level_mapping_failed'
  | 'simulation_failed'
  | 'wasm_load_failed'
  | 'worker_load_failed'
  | 'out_of_memory'
  | 'invalid_input'
  | 'unexpected'

export interface SolverFailure {
  code: SolverFailureCode
  message: string
  detail?: string
}

export type SolverResult =
  | { ok: true; value: SolveResponse }
  | { ok: false; error: SolverFailure }
