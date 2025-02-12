import { vi, describe, it, expect, beforeEach } from 'vitest'
import HLSJS from 'hls.js'

import HlsPlayback from '../HlsPlayback'

vi.mock('hls.js', () => ({
  default: {
    isSupported: vi.fn(),
  }
}))

describe('HlsPlayback', () => {
  describe('canPlay', () => {
    describe('when not supported', () => {
      beforeEach(() => {
        vi.mocked(HLSJS.isSupported).mockReturnValue(false)
      })
      describe.each([
        [
          '/123123_1232',
          'application/x-mpegurl',
          ],
        [
          '/123123_1232',
          'application/vnd.apple.mpegurl',
        ],
        [
          '/123123_1232.m3u8',
          undefined
        ]
      ])("%s %s", (resource, mimeType) => {
        it('should return false', () => {
          expect(HlsPlayback.canPlay(resource, mimeType)).toBe(false)
        })
      })
    })
    describe('when supported', () => {
      beforeEach(() => {
        vi.mocked(HLSJS.isSupported).mockReturnValue(true)
      })
      describe.each([
        [
          '/123123_1232',
          'application/x-mpegurl',
          true,
        ],
        [
          '/123123_1232',
          'application/vnd.apple.mpegurl',
          true,
        ],
        [
          '/123123_1232.m3u8',
          undefined,
          true,
        ],
        [
          '/123123_1232.mpd',
          undefined,
          false
        ],
        [
          '/123123_1232.m3u8',
          'video/mp4',
          false
        ],
        [
          '/123123_1232',
          'video/mp4',
          false
        ],
      ])("%s %s", (resource, mimeType, expected) => {
        it('should respect the mime type if present and file extention otherwise', () => {
          expect(HlsPlayback.canPlay(resource, mimeType)).toBe(expected)
        })
      })
    })
  })
})
