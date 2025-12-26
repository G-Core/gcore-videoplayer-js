import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Loader } from '@clappr/core'

import {
  isDashSource,
  isHlsSource,
  buildMediaSourcesList,
} from '../mediaSources'
import { TransportPreference } from '../../types'
import { canPlayDash, canPlayHls } from '../../playback/index'

vi.mock('@clappr/core', () => ({
  Loader: {
    registeredPlaybacks: [
      {
        _supported: true,
        prototype: {
          name: 'dash',
        },
        canPlay(source, mimeType) {
          return (
            this._supported &&
            (mimeType === 'application/dash+xml' || source.endsWith('.mpd'))
          )
        },
      },
      {
        _supported: true,
        prototype: {
          name: 'hls',
        },
        canPlay(source, mimeType) {
          return (
            this._supported &&
            ([
              'application/vnd.apple.mpegurl',
              'application/x-mpegurl',
            ].includes(mimeType) ||
              source.endsWith('.m3u8'))
          )
        },
      },
      {
        _supported: true,
        prototype: {
          name: 'html5_video',
        },
        canPlay: function (source, mimeType) {
          return this._supported && mimeType === 'video/mp4'
        },
      },
    ],
  },
}))

vi.mock('../../playback/index.js', () => ({
  canPlayDash: vi.fn(),
  canPlayHls: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(canPlayDash).mockImplementation(isDashSource)
  vi.mocked(canPlayHls).mockImplementation(isHlsSource)
})

describe('mediaSources', () => {
  describe('buildMediaSourcesList', () => {
    describe.each([
      [
        'dash',
        true,
        true,
        [
          {
            source: 'http://example.com/video.m3u8',
            mimeType: 'application/vnd.apple.mpegurl',
          },
          {
            source: 'http://example.com/video.mpd',
            mimeType: 'application/dash+xml',
          },
          {
            source: 'http://example.com/video2.mpd',
            mimeType: 'application/dash+xml',
          },
          {
            source: 'http://example.com/video3.m3u8',
            mimeType: 'application/vnd.apple.mpegurl',
          },
        ],
        [
          {
            source: 'http://example.com/video.mpd',
            mimeType: 'application/dash+xml',
          },
          {
            source: 'http://example.com/video2.mpd',
            mimeType: 'application/dash+xml',
          },
          {
            source: 'http://example.com/video.m3u8',
            mimeType: 'application/vnd.apple.mpegurl',
          },
          {
            source: 'http://example.com/video3.m3u8',
            mimeType: 'application/vnd.apple.mpegurl',
          },
        ],
      ],
      [
        'hls',
        true,
        true,
        [
          {
            source: 'http://example.com/video.m3u8',
            mimeType: 'application/vnd.apple.mpegurl',
          },
          {
            source: 'http://example.com/video.mpd',
            mimeType: 'application/dash+xml',
          },
          {
            source: 'http://example.com/video2.mpd',
            mimeType: 'application/dash+xml',
          },
          {
            source: 'http://example.com/video3.m3u8',
            mimeType: 'application/vnd.apple.mpegurl',
          },
        ],
        [
          {
            source: 'http://example.com/video.m3u8',
            mimeType: 'application/vnd.apple.mpegurl',
          },
          {
            source: 'http://example.com/video3.m3u8',
            mimeType: 'application/vnd.apple.mpegurl',
          },
          {
            source: 'http://example.com/video.mpd',
            mimeType: 'application/dash+xml',
          },
          {
            source: 'http://example.com/video2.mpd',
            mimeType: 'application/dash+xml',
          },
        ],
      ],
      [
        'dash',
        false,
        true,
        [
          {
            source: 'http://example.com/video.m3u8',
            mimeType: 'application/vnd.apple.mpegurl',
          },
          {
            source: 'http://example.com/video.mpd',
            mimeType: 'application/dash+xml',
          },
          {
            source: 'http://example.com/video2.mpd',
            mimeType: 'application/dash+xml',
          },
          {
            source: 'http://example.com/video3.m3u8',
            mimeType: 'application/vnd.apple.mpegurl',
          },
        ],
        [
          {
            source: 'http://example.com/video.m3u8',
            mimeType: 'application/vnd.apple.mpegurl',
          },
          {
            source: 'http://example.com/video3.m3u8',
            mimeType: 'application/vnd.apple.mpegurl',
          },
        ],
      ],
      [
        'hls',
        true,
        false,
        [
          {
            source: 'http://example.com/video.m3u8',
            mimeType: 'application/vnd.apple.mpegurl',
          },
          {
            source: 'http://example.com/video.mpd',
            mimeType: 'application/dash+xml',
          },
          {
            source: 'http://example.com/video2.mpd',
            mimeType: 'application/dash+xml',
          },
          {
            source: 'http://example.com/video3.m3u8',
            mimeType: 'application/vnd.apple.mpegurl',
          },
        ],
        [
          {
            source: 'http://example.com/video.mpd',
            mimeType: 'application/dash+xml',
          },
          {
            source: 'http://example.com/video2.mpd',
            mimeType: 'application/dash+xml',
          },
        ],
      ],
    ])(
      'prefer %s, dash=%s,hls=%s',
      (preference, dash, hls, sources, expected) => {
        beforeEach(() => {
          if (!dash) {
            Loader.registeredPlaybacks[0]._supported = false
          }
          if (!hls) {
            Loader.registeredPlaybacks[1]._supported = false
          }
        })
        afterEach(() => {
          Loader.registeredPlaybacks[0]._supported = true
          Loader.registeredPlaybacks[1]._supported = true
        })
        it('should build the ordered list of available sources', () => {
          const ordered = buildMediaSourcesList(
            sources,
            preference as TransportPreference,
          )
          expect(ordered).toEqual(expect.objectContaining(expected))
        })
      },
    )
  })
})
