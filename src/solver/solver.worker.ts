/// <reference lib="webworker" />

import initWasm, { solve_and_simulate } from '../../pkg-wasm/ff14_moon_wasm.js'
import { failure, normalizeSolverFailure } from './failures'
import type { SolveResponse } from './types'
import type { SolveWorkerRequest, SolveWorkerResponse } from './worker-protocol'

const workerScope = self as DedicatedWorkerGlobalScope
let wasmReady: Promise<void> | undefined

function loadWasm(): Promise<void> {
  wasmReady ??= initWasm().then(() => undefined)
  return wasmReady
}

workerScope.onmessage = async (event: MessageEvent<SolveWorkerRequest>) => {
  const message = event.data
  if (message.kind !== 'solve') return

  try {
    await loadWasm()
  } catch (error) {
    post({
      kind: 'failure',
      requestId: message.requestId,
      error: failure('wasm_load_failed', '無法載入本機 WASM 求解器。', String(error)),
    })
    return
  }

  try {
    const payload = solve_and_simulate(message.payload) as SolveResponse
    post({ kind: 'success', requestId: message.requestId, payload })
  } catch (error) {
    post({ kind: 'failure', requestId: message.requestId, error: normalizeSolverFailure(error) })
  }
}

loadWasm()
  .then(() => post({ kind: 'ready' }))
  .catch(() => {
    // The request path returns a typed load failure with the original detail.
  })

function post(message: SolveWorkerResponse): void {
  workerScope.postMessage(message)
}
