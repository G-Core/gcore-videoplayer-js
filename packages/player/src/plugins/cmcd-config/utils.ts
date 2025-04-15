export function generateSessionId(): string {
  return window.crypto.randomUUID()
}
