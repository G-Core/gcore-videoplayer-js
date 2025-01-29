import { describe, expect, it, vi } from 'vitest'

import { buildSourcesSet } from '../mediaSources'
// import { canPlayDash, canPlayHls } from '../../playback/index.js'

vi.mock('../../playback/index.js', () => ({
  canPlayDash: vi
    .fn()
    .mockImplementation(
      (source, mimeType) =>
        mimeType === 'application/dash+xml' || source.endsWith('.mpd'),
    ),
  canPlayHls: vi
    .fn()
    .mockImplementation(
      (source, mimeType) =>
        ['application/vnd.apple.mpegurl', 'application/x-mpegURL'].includes(
          mimeType,
        ) || source.endsWith('.m3u8'),
    ),
}))

describe('mediaSources', () => {
  describe('buildSourcesSet', () => {
    it.each([
      [
        [
          { source: 'http://example.com/video.mpd' },
          { source: 'http://example.com/video.m3u8' },
          { source: 'http://example.com/video.mpegts' },
        ],
        {
          dash: {source: 'http://example.com/video.mpd'},
          hls: {source: 'http://example.com/video.m3u8'},
          mpegts: {source: 'http://example.com/video.mpegts'},
        },
      ],
    ])('should build sources set', (sources, expected) => {
      const sourcesSet = buildSourcesSet(sources)
      expect(sourcesSet).toEqual(expect.objectContaining(expected))
    })
  })
})
