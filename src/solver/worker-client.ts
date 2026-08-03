import { failure } from './failures'
import type { SolveRequest, SolverResult } from './types'
import type { SolveWorkerRequest, SolveWorkerResponse } from './worker-protocol'

interface ActiveRequest {
  id: string
  resolve: (result: SolverResult) => void
}

export class SolverWorkerClient {
  private worker: Worker | undefined
  private active: ActiveRequest | undefined

  solve(payload: SolveRequest): Promise<SolverResult> {
    if (this.active !== undefined) {
      return Promise.resolve({
        ok: false,
        error: failure('unexpected', '已有一項求解正在執行。'),
      })
    }

    const worker = this.ensureWorker()
    const requestId = crypto.randomUUID()
    const message: SolveWorkerRequest = { kind: 'solve', requestId, payload }

    return new Promise((resolve) => {
      this.active = { id: requestId, resolve }
      worker.postMessage(message)
    })
  }

  cancel(): void {
    if (this.active === undefined) return
    const active = this.active
    this.active = undefined
    this.worker?.terminate()
    this.worker = undefined
    active.resolve({ ok: false, error: failure('cancelled', '求解已取消。') })
  }

  dispose(): void {
    this.cancel()
    this.worker?.terminate()
    this.worker = undefined
  }

  private ensureWorker(): Worker {
    if (this.worker !== undefined) return this.worker

    const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<SolveWorkerResponse>) => this.receive(event.data)
    worker.onerror = (event) => {
      this.finish({
        ok: false,
        error: failure('worker_load_failed', '瀏覽器無法啟動本機求解 Worker。', event.message),
      })
      worker.terminate()
      if (this.worker === worker) this.worker = undefined
    }
    this.worker = worker
    return worker
  }

  private receive(message: SolveWorkerResponse): void {
    if (message.kind === 'ready' || this.active?.id !== message.requestId) return
    if (message.kind === 'success') {
      this.finish({ ok: true, value: message.payload })
    } else {
      this.finish({ ok: false, error: message.error })
    }
  }

  private finish(result: SolverResult): void {
    const active = this.active
    if (active === undefined) return
    this.active = undefined
    active.resolve(result)
  }
}
