import type { SolverFailure, SolverFailureCode } from './types'

const OUT_OF_MEMORY_PATTERN = /out of memory|memory access out of bounds|allocation failed/i

interface WasmErrorShape {
  code?: unknown
  message?: unknown
}

export function normalizeSolverFailure(error: unknown): SolverFailure {
  const shape = isRecord(error) ? (error as WasmErrorShape) : undefined
  const sourceCode = typeof shape?.code === 'string' ? shape.code : undefined
  const detail = typeof shape?.message === 'string' ? shape.message : String(error)

  if (OUT_OF_MEMORY_PATTERN.test(detail)) {
    return failure(
      'out_of_memory',
      '瀏覽器記憶體不足，無法完成這次求解。請關閉其他分頁或縮小求解範圍後重試。',
      detail,
    )
  }

  switch (sourceCode) {
    case 'no_solution':
      return failure(
        'insufficient_attributes',
        '目前能力值與求解選項找不到可完成配方的解答。',
        detail,
      )
    case 'player_level_too_low':
    case 'invalid_craft_parameters':
    case 'invalid_input':
      return failure('invalid_input', detail)
    case 'simulation_failed':
      return failure('simulation_failed', detail)
    case 'solver_interrupted':
      return failure('cancelled', '求解已取消。', detail)
    default:
      return failure('unexpected', '求解時發生未預期的錯誤。', detail)
  }
}

export function failure(
  code: SolverFailureCode,
  message: string,
  detail?: string,
): SolverFailure {
  return detail === undefined ? { code, message } : { code, message, detail }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
