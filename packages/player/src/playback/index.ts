import { Loader } from '@clappr/core'

import DashPlayback from './dash-playback/DashPlayback.js'
import HlsPlayback from './hls-playback/HlsPlayback.js'
import HTML5Video from './HTML5Video.js'

export function registerPlaybacks() {
  // Prevent "overriding playback entry" warning
  Loader.unregisterPlayback(HTML5Video.prototype.name)
  Loader.registerPlayback(HTML5Video)
  Loader.registerPlayback(HlsPlayback)
  Loader.registerPlayback(DashPlayback)
}

export function canPlayDash(source: string, mimeType?: string) {
  return DashPlayback.canPlay(source, mimeType)
}

export function canPlayHls(source: string, mimeType?: string) {
  return HlsPlayback.canPlay(source, mimeType)
}
