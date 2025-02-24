import { ErrorOptions, Events, HTML5Video, PlayerError } from '@clappr/core'

import { PlaybackErrorCode } from '../playback.types.js'

/**
 * This class adds common behaviors to all playback modules.
 * @internal
 * TODO use custom HTML5Video playback with this layer applied
 */
export class BasePlayback extends HTML5Video {
  createError(errorData: any, options?: ErrorOptions) {
    const i18n =
      this.i18n ||
        // @ts-ignore
        (this.core && this.core.i18n) ||
        // @ts-ignore
        (this.container && this.container.i18n)

    if (
      i18n &&
      !errorData.UI &&
      errorData.code === PlaybackErrorCode.MediaSourceUnavailable
    ) {
      const defaultUI = {
        title: i18n.t('no_broadcast'),
        message: '',
      }
      errorData.UI = defaultUI
    }

    if (errorData.level === PlayerError.Levels.FATAL) {
      this.trigger(Events.PLAYBACK_MEDIACONTROL_DISABLE)
    }
    return super.createError(errorData, options)
  }

  override _onPlaying() {
    super._onPlaying()
    this.trigger(Events.PLAYBACK_MEDIACONTROL_ENABLE)
  }
}
