import type { SolveRequest, SolveResponse, SolverFailure } from './types'

export interface SolveWorkerRequest {
  kind: 'solve'
  requestId: string
  payload: SolveRequest
}

export type SolveWorkerResponse =
  | { kind: 'ready' }
  | { kind: 'success'; requestId: string; payload: SolveResponse }
  | { kind: 'failure'; requestId: string; error: SolverFailure }
