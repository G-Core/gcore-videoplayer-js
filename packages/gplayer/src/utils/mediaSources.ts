import { PlayerMediaSource } from '../internal.types'
import DashPlayback from '../plugins/dash-playback/DashPlayback'
import HlsPlayback from '../plugins/hls-playback/HlsPlayback'
import { StreamMediaSource, TransportPreference } from '../types'

export type SourceVariants = {
  dash: string | null
  master: string | null
  hls: string | null
  mpegts: string | null
}

export function buildSourcesSet(sources: PlayerMediaSource[]): SourceVariants {
  const sv: SourceVariants = {
    dash: null,
    master: null,
    hls: null,
    mpegts: null,
  }
  sources.forEach((ps) => {
    const [s, t] = typeof ps === 'string' ? [ps, ''] : [ps.source, ps.mimeType]
    if (DashPlayback.canPlay(s, t)) {
      sv.dash = s
    } else if (HlsPlayback.canPlay(s, t)) {
      sv.hls = s
    } else {
      sv.master = s
    }
  })
  return sv
}

export function buildSourcesPriorityList(
  sources: SourceVariants,
  priorityTransport: TransportPreference = 'auto',
): PlayerMediaSource[] {
  const msl: string[] = []
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
    if (sources.hls && HlsPlayback.canPlay(sources.hls, undefined)) {
      msl.push(sources.hls)
      sources.hls = null
    }
    if (
      sources.master?.endsWith('.m3u8') &&
      HlsPlayback.canPlay(sources.master, undefined)
    ) {
      msl.push(sources.master)
      sources.master = null
    }
  }

  function addDash() {
    if (sources.dash && DashPlayback.canPlay(sources.dash, undefined)) {
      msl.push(sources.dash)
      sources.dash = null
    }
  }
}

export function unwrapSource(s: PlayerMediaSource): string {
  return typeof s === 'string' ? s : s.source
}

export function buildGcoreStreamSourcesList(
  ms: StreamMediaSource,
  priorityTransport: TransportPreference,
): PlayerMediaSource[] {
  const sources: Record<'dash' | 'master' | 'hls' | 'mpegts', string | null> = {
    dash: ms.sourceDash,
    master: ms.source,
    hls: ms.hlsCmafUrl,
    mpegts: ms.hlsMpegtsUrl,
  }
  return buildSourcesPriorityList(sources, priorityTransport)
}
