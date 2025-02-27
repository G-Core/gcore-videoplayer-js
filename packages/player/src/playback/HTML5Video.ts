import { PlayerError, Events as ClapprEvents } from '@clappr/core'
import { ErrorOptions } from '@clappr/core'

import { PlaybackErrorCode } from '../playback.types.js'
import { BasePlayback } from './BasePlayback.js'
import { trace } from '@gcorevideo/utils'
import { TimerId } from '../utils/types.js'

const T = 'playback.html5_video'

const STALL_TIMEOUT = 15000

export default class HTML5Video extends BasePlayback {
  private stallTimerId: TimerId | null = null

  /**
   * @internal
   */
  override createError(errorData: any, options?: ErrorOptions) {
    trace(`${T} createError`, {
      errorData: { ...errorData },
    })
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
      // errorData.UI = {
      //   title: i18n.t('no_broadcast'),
      //   message: errorData.message,
      // }
      errorData.code = PlaybackErrorCode.MediaSourceUnavailable
    }
    return super.createError(errorData, { ...options, useCodePrefix: false })
  }

  override _onWaiting() {
    trace(`${T} _onWaiting`)
    super._onWaiting()
  }

  override _onEnded() {
    trace(`${T} _onEnded`)
    if (this.stallTimerId) {
      clearTimeout(this.stallTimerId)
      this.stallTimerId = null
    }
    super._onEnded()
  }

  override _handleBufferingEvents() {
    trace(`${T} _handleBufferingEvents`, {
      networkState: (this.el as HTMLMediaElement).networkState,
    })
    if (!this.stallTimerId) {
      this.stallTimerId = setTimeout(() => {
        trace(`${T} _handleBufferingEvents stall timeout`, {
          buffering: this.buffering,
          ended: this.ended,
        })
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
    trace(`${T} _onPlaying`)
    if (this.stallTimerId) {
      clearTimeout(this.stallTimerId)
      this.stallTimerId = null
    }
    super._onPlaying()
  }

  override _onPause() {
    trace(`${T} _onPause`)
    super._onPause()
    if (this.stallTimerId) {
      clearTimeout(this.stallTimerId)
      this.stallTimerId = null
    }
  }
}
