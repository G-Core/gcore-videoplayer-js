import type { Tracer } from './Tracer'

type TraceRecord = {
  message: string
  detail?: Record<string, unknown>
  time: number
}

type TimerId = ReturnType<typeof setTimeout>

type RemoteTracerOptions = {
  delay?: number
}

const DEFAULT_DELAY = 1000
const MIN_DELAY = 1000

/**
 * A tracer the pushes the records to a remote server.
 * Used with fullstack Node.js applications (Nuxt.js, Next.js, etc.)
 * @beta
 */
export class RemoteTracer implements Tracer {
  private buffer: Array<TraceRecord> = []

  private timerId: TimerId | null = null

  private delay: number

  /**
   *
   * @param baseTracer An additional tracer to be called next to this one. Deprecated. Use {@link ChainedTracer} instead.
   * @param tags
   * @param options
   */
  constructor(
    private baseTracer: Tracer | undefined,
    private tags: Record<string, unknown> = {},
    options: RemoteTracerOptions = {},
  ) {
    this.delay = Math.max(options.delay ?? DEFAULT_DELAY, MIN_DELAY)
  }

  reportError(e: unknown): void {
    if (this.baseTracer) {
      this.baseTracer.reportError(e)
    }
    const message = String(e)
    const detail =
      e instanceof Error && 'detail' in e
        ? (e.detail as Record<string, unknown>)
        : undefined
    this.push(message, detail)
  }

  trace(message: string, detail: Record<string, unknown>): void {
    if (this.baseTracer) {
      this.baseTracer.trace(message, detail)
    }
    this.push(message, detail)
  }

  setTag(key: string, value: unknown): void {
    this.tags[key] = value
  }

  private push(message: string, detail?: Record<string, unknown>) {
    const time = new Date().getTime()
    this.buffer.push({ message, detail, time })
    if (!this.timerId) {
      this.timerId = setTimeout(() => {
        this.timerId = null
        this.send(this.buffer.splice(0, this.buffer.length))
      }, this.delay)
    }
  }

  private send(records: TraceRecord[]) {
    fetch('/api/traceb', {
      method: 'POST',
      body: JSON.stringify({
        records,
        tags: this.tags,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch((e) => console.error(e))
  }
}
