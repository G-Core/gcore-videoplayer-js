import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isDashSource, isHlsSource, buildMediaSourcesList } from '../mediaSources'
import { TransportPreference } from '../../types'
import { canPlayDash, canPlayHls } from '../../playback/index'

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
      ],
    ])('prefer %s, dash=%s,hls=%s', (preference, dash, hls, sources, expected) => {
      beforeEach(() => {
        if (!dash) {
          vi.mocked(canPlayDash).mockReturnValue(false)
        }
        if (!hls) {
          vi.mocked(canPlayHls).mockReturnValue(false)
        }
      })
      it('should build the ordered list of available sources', () => {
        const ordered = buildMediaSourcesList(
          sources,
          preference as TransportPreference,
        )
        expect(ordered).toEqual(expect.objectContaining(expected))
      })
    })
  })
})
