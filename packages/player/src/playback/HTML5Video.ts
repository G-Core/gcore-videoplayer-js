import { ErrorOptions } from '@clappr/core'

import { PlaybackErrorCode } from '../playback.types.js'
import { BasePlayback } from './BasePlayback.js'

export default class HTML5Video extends BasePlayback {
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
      errorData.UI = {
        title: i18n.t('no_broadcast'),
        message: errorData.message,
      }
      errorData.code = PlaybackErrorCode.MediaSourceUnavailable
    }
    return super.createError(errorData, { ...options, useCodePrefix: false })
  }
}
