export function generateSessionId(): string {
  return window.crypto.randomUUID()
}

export function generateContentId(sourceUrl: string): Promise<string> {
  return window.crypto.subtle.digest('SHA-1', new TextEncoder().encode(sourceUrl))
    .then(buffer => {
      const hex = Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      return hex
    })
}
