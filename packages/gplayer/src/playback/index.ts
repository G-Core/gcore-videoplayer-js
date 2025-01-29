import { Loader } from '@clappr/core'

import DashPlayback from '../plugins/dash-playback/DashPlayback.js'
import HlsPlayback from '../plugins/hls-playback/HlsPlayback.js'

export function registerPlaybacks() {
  Loader.registerPlayback(DashPlayback)
  Loader.registerPlayback(HlsPlayback)
}

export function canPlayDash(source: string, mimeType?: string) {
  return DashPlayback.canPlay(source, mimeType)
}

export function canPlayHls(source: string, mimeType?: string) {
  return HlsPlayback.canPlay(source, mimeType)
}
