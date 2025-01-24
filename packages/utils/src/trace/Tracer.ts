export interface Tracer {
  reportError(e: unknown): void;
  trace(msg: string, data: Record<string, unknown>): void;
}
