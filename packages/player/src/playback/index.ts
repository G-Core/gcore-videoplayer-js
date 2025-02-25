import { Loader } from '@clappr/core'

import DashPlayback from './dash-playback/DashPlayback.js'
import HlsPlayback from './hls-playback/HlsPlayback.js'
import HTML5Video from './HTML5Video.js'
// TODO consider allowing the variation of the order of playback modules
export function registerPlaybacks() {
  Loader.registerPlayback(HTML5Video) // TODO check it overrides the default HTML5Video
  Loader.registerPlayback(HlsPlayback)
  Loader.registerPlayback(DashPlayback)
}

export function canPlayDash(source: string, mimeType?: string) {
  return DashPlayback.canPlay(source, mimeType)
}

export function canPlayHls(source: string, mimeType?: string) {
  return HlsPlayback.canPlay(source, mimeType)
}
