import { Tracer } from './Tracer'

/**
 * A tracer that pushes a record through a chain of tracers
 * @beta
 */
export class ChainedTracer implements Tracer {
  constructor(private tracers: Tracer[]) {}

  reportError(e: unknown): void {
    for (const tracer of this.tracers) {
      tracer.reportError(e)
    }
  }

  trace(msg: string, data: Record<string, unknown>): void {
    for (const tracer of this.tracers) {
      tracer.trace(msg, data)
    }
  }
}
