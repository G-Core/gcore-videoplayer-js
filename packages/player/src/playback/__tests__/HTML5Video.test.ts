import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HTML5Video from '../HTML5Video.js'
import { PlaybackErrorCode } from '../../playback.types.js'

let savedMediaError: any

beforeEach(() => {
  savedMediaError = globalThis.MediaError
  if (!globalThis.MediaError) {
    globalThis.MediaError = {
      MEDIA_ERR_ABORTED: 1,
      MEDIA_ERR_NETWORK: 2,
      MEDIA_ERR_DECODE: 3,
      MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
    } as any
  }
})

afterEach(() => {
  globalThis.MediaError = savedMediaError
})

describe('HTML5Video', () => {
  describe('errors', () => {
    describe('when the media element emits MEDIA_ERR_SRC_NOT_SUPPORTED', () => {
      it('should trigger MEDIA_SOURCE_UNAVAILABLE error', () => {
        const i18n = {
          t: vi.fn().mockImplementation((key: string) => key),
        }
        const playerError = {
          createError: vi.fn(),
        }
        const html5Video = new HTML5Video({}, i18n, playerError)
        html5Video.load('https://example.com/video.mp4')
        vi.spyOn(html5Video.el as HTMLVideoElement, 'error', 'get').mockReturnValue({
          code: MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED,
          message: 'Media source not supported',
        } as any)
        html5Video.el.dispatchEvent(new Event('error', { bubbles: true }))
        expect(playerError.createError).toHaveBeenCalledWith(expect.objectContaining({
          code: PlaybackErrorCode.MediaSourceUnavailable,
        }))
      })
    })
  })
})
