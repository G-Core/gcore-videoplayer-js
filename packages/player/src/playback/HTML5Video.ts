import { PlayerError, Events as ClapprEvents } from '@clappr/core'
import { ErrorOptions } from '@clappr/core'

import { PlaybackErrorCode } from '../playback.types.js'
import { BasePlayback } from './BasePlayback.js'
import { trace } from '@gcorevideo/utils'
import { TimerId } from '../utils/types.js'
import { AudioTrack } from '@clappr/core/types/base/playback/playback.js'

const T = 'playback.html5_video'

const STALL_TIMEOUT = 15000

export default class HTML5Video extends BasePlayback {
  private stallTimerId: TimerId | null = null

  /**
   * @internal
   */
  override createError(errorData: any, options?: ErrorOptions) {
    const i18n =
      this.i18n ||
      // @ts-ignore
      (this.core && this.core.i18n) ||
      // @ts-ignore
      (this.container && this.container.i18n)

    if (
      i18n &&
      !errorData.UI &&
      errorData.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
    ) {
      errorData.code = PlaybackErrorCode.MediaSourceUnavailable
    }
    return super.createError(errorData, { ...options, useCodePrefix: false })
  }

  override _onWaiting() {
    super._onWaiting()
  }

  override _onEnded() {
    if (this.stallTimerId) {
      clearTimeout(this.stallTimerId)
      this.stallTimerId = null
    }
    super._onEnded()
  }

  override _handleBufferingEvents() {
    if (!this.stallTimerId) {
      this.stallTimerId = setTimeout(() => {
        this.stallTimerId = null
        const error = this.createError({
          code: PlaybackErrorCode.MediaSourceUnavailable,
          level: PlayerError.Levels.FATAL,
          message: 'Stall timeout',
          description: 'Playback stalled for too long',
        })
        this.trigger(ClapprEvents.PLAYBACK_ERROR, error)
        setTimeout(() => this.stop(), 0)
      }, STALL_TIMEOUT)
    }
    super._handleBufferingEvents()
  }

  override _onPlaying() {
    if (this.stallTimerId) {
      clearTimeout(this.stallTimerId)
      this.stallTimerId = null
    }
    super._onPlaying()
  }

  override _onPause() {
    super._onPause()
    if (this.stallTimerId) {
      clearTimeout(this.stallTimerId)
      this.stallTimerId = null
    }
  }

  get audioTracks(): AudioTrack[] {
    const tracks = (this.el as HTMLMediaElement).audioTracks
    const supported = !!tracks
    const retval: AudioTrack[] = []
    if (supported) {
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i]
        retval.push({
          id: track.id,
          label: track.label,
          language: track.language,
          kind: track.kind as 'main' | 'description', // TODO check
        } as AudioTrack)
      }
    }
    return retval
  }

  // @ts-expect-error
  get currentAudioTrack() {
    const tracks = (this.el as HTMLMediaElement).audioTracks
    const supported = !!tracks
    if (supported) {
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i]
        if (track.enabled) {
          return {
            id: track.id,
            label: track.label,
            language: track.language,
            kind: track.kind,
          } as AudioTrack
        }
      }
    }
    return null
  }

  switchAudioTrack(id: string) {
    const tracks = (this.el as HTMLMediaElement).audioTracks
    const supported = !!tracks
    trace(`${T} switchAudioTrack`, {
      supported,
    })
    if (supported) {
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i]
        track.enabled = track.id === id
      }
    }
  }
}
