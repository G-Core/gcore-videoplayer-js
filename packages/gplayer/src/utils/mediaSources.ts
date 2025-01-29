import type { PlayerMediaSource, PlayerMediaSourceDesc, TransportPreference } from '../types'
import { canPlayDash, canPlayHls } from '../playback/index.js'

export type SourceVariants = {
  dash: PlayerMediaSourceDesc | null
  hls: PlayerMediaSourceDesc | null
  mpegts: PlayerMediaSourceDesc | null
}

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

export function buildSourcesPriorityList(
  sources: SourceVariants,
  priorityTransport: TransportPreference = 'auto',
): PlayerMediaSourceDesc[] {
  const msl: PlayerMediaSourceDesc[] = []
  switch (priorityTransport) {
    case 'dash':
      addDash()
      break
    case 'hls':
      addHls()
      break
    case 'mpegts':
      addMpegts()
      break
    case 'auto':
      addDash()
      addHls()
      addMpegts()
      break
  }
  Object.values(sources).forEach((s) => {
    if (s) {
      msl.push(s)
    }
  })
  return msl

  function addMpegts() {
    if (sources.mpegts) {
      msl.push(sources.mpegts)
      sources.mpegts = null
    }
  }

  function addHls() {
    if (sources.hls && canPlayHls(sources.hls.source, sources.hls.mimeType)) {
      msl.push(sources.hls)
      sources.hls = null
    }
  }

  function addDash() {
    if (sources.dash && canPlayDash(sources.dash.source, sources.dash.mimeType)) {
      msl.push(sources.dash)
      sources.dash = null
    }
  }
}

export function unwrapSource(s: PlayerMediaSource): string {
  return typeof s === 'string' ? s : s.source
}

export function wrapSource(s: PlayerMediaSource): PlayerMediaSourceDesc {
  return typeof s === 'string' ? { source: s } : s
}
