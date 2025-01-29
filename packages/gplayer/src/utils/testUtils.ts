export function isDashSource(source: string, mimeType?: string) {
  if (mimeType) {
    return mimeType === 'application/dash+xml'
  }
  return source.endsWith('.mpd')
}

export function isHlsSource(source: string, mimeType?: string) {
  if (mimeType) {
    return ['application/vnd.apple.mpegurl', 'application/x-mpegURL'].includes(
      mimeType,
    )
  }
  return source.endsWith('.m3u8')
}
