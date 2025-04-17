/**
 * Video player for the Gcore streaming platform
 *
 * @remarks
 * This package provides a video player for the Gcore streaming platform.
 * It is built on top of the {@link https://github.com/clappr/clappr | Clappr} library and provides a framework for building custom integrations.
 * Start with {@link Player} for more information.
 *
 * Various plugins (marked with `PLUGIN` keyword) are available to extend the core functionality with additional features.
 * @example
 * ```ts
 * import { Player, MediaControl, ErrorScreen } from '@gcorevideo/player'
 *
 * Player.registerPlugin(MediaControl)
 * Player.registerPlugin(ErrorScreen)
 *
 * const player = new Player({
 *   autoPlay: true,
 *   mute: true,
 *   sources: [{ source: 'https://example.com/a.mpd', mimeType: 'application/dash+xml' }],
 * })
 *
 * player.attachTo(document.getElementById('container'))
 * ```
 *
 * @packageDocumentation
 */
import { Player, PlayerMediaSource, PlayerConfig } from './index.core.js'
import {
  AudioTracks,
  BigMuteButton,
  BottomGear,
  MediaControl,
  ErrorScreen,
  SourceController,
  Subtitles,
  CmcdConfig,
  ClickToPause,
  DvrControls,
  PictureInPicture,
  PlaybackRate,
  Poster,
  Spinner,
} from './index.plugins.js'

Player.registerPlugin(AudioTracks)
Player.registerPlugin(BigMuteButton)
Player.registerPlugin(BottomGear)
Player.registerPlugin(ClickToPause)
Player.registerPlugin(CmcdConfig)
Player.registerPlugin(DvrControls)
Player.registerPlugin(ErrorScreen)
Player.registerPlugin(MediaControl)
Player.registerPlugin(PictureInPicture)
Player.registerPlugin(PlaybackRate)
Player.registerPlugin(Poster)
Player.registerPlugin(SourceController)
Player.registerPlugin(Spinner)
Player.registerPlugin(Subtitles)
type Options = Partial<Omit<PlayerConfig, 'sources'>> & {
  sources: PlayerMediaSource[]
}

export default function init(domNode: HTMLElement, options: Options) {
  const player = new Player({
    autoPlay: true,
    mute: true,
    ...options,
  })
  if (document.readyState === 'interactive') {
    setTimeout(() => {
      player.attachTo(domNode)
    }, 0)
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      player.attachTo(domNode)
    })
  }
}
