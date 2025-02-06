import type {
  PlayerMediaSource,
  PlayerMediaSourceDesc,
  TransportPreference,
} from '../types'
import { canPlayDash, canPlayHls } from '../playback/index.js'

export type SourceVariants = {
  dash: PlayerMediaSourceDesc | null
  hls: PlayerMediaSourceDesc | null
  mpegts: PlayerMediaSourceDesc | null
}

/**
 *
 * @param sources
 * @deprecated
 * @returns
 */
export function buildSourcesSet(sources: PlayerMediaSource[]): SourceVariants {
  const sv: SourceVariants = {
    dash: null,
    hls: null,
    mpegts: null,
  }
  sources.forEach((ps) => {
    const ws = wrapSource(ps)
    if (canPlayDash(ws.source, ws.mimeType)) {
      sv.dash = ws
    } else if (canPlayHls(ws.source, ws.mimeType)) {
      sv.hls = ws
    } else {
      sv.mpegts = ws
    }
  })
  return sv
}

export function buildMediaSourcesList(
  sources: PlayerMediaSourceDesc[],
  priorityTransport: TransportPreference = 'dash',
): PlayerMediaSourceDesc[] {
  const [preferred, rest] = sources.reduce(
    // Always include HLS sources to enable HTML5 fallback
    priorityTransport === 'dash'
      ? (
          acc: [PlayerMediaSourceDesc[], PlayerMediaSourceDesc[]],
          item: PlayerMediaSourceDesc,
        ) => {
          if (canPlayDash(item.source, item.mimeType)) {
            acc[0].push(item)
          } else if (!isDashSource(item.source, item.mimeType)) {
            acc[1].push(item)
          }
          return acc
        }
      : (
          acc: [PlayerMediaSourceDesc[], PlayerMediaSourceDesc[]],
          item: PlayerMediaSourceDesc,
        ) => {
          if (canPlayHls(item.source, item.mimeType)) {
            acc[0].push(item)
          } else if (!(isDashSource(item.source, item.mimeType) && !canPlayDash(item.source, item.mimeType))) {
            acc[1].push(item)
          }
          return acc
        },
    [[], []],
  )
  return preferred.concat(rest)
}

export function unwrapSource(s: PlayerMediaSource): string {
  return typeof s === 'string' ? s : s.source
}

export function wrapSource(s: PlayerMediaSource): PlayerMediaSourceDesc {
  return typeof s === 'string' ? { source: s, mimeType: guessMimeType(s) } : s
}

function guessMimeType(s: string): string | undefined {
  if (s.endsWith('.mpd')) {
    return 'application/dash+xml'
  }
  if (s.endsWith('.m3u8')) {
    return 'application/vnd.apple.mpegurl'
  }
}

export function isDashSource(source: string, mimeType?: string) {
  if (mimeType) {
    return mimeType === 'application/dash+xml' // TODO consider video/mp4
  }
  return source.endsWith('.mpd')
}

export function isHlsSource(source: string, mimeType?: string) {
  if (mimeType) {
    return ['application/vnd.apple.mpegurl', 'application/x-mpegurl'].includes(
      mimeType.toLowerCase(),
    )
  }
  return source.endsWith('.m3u8')
}
