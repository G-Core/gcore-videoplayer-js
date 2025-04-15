import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CmcdConfig } from '../CmcdConfig'
import { createMockCore } from '../../../testUtils'
import { Events } from '@clappr/core'

vi.mock('../utils', () => ({
  generateSessionId: vi.fn().mockReturnValue('123'),
}))

const CMCD_KEYS = [
  'br',
  'd',
  'ot',
  'tb',
  'bl',
  'dl',
  'mtp',
  'nor',
  'nrr',
  'su',
  'bs',
  'rtp',
  'cid',
  'pr',
  'sf',
  'sid',
  'st',
  'v',
]

describe('CmcdConfig', () => {
  let core: any
  let plugin: CmcdConfig
  describe('basically', () => {
    beforeEach(() => {
      core = createMockCore({
        sources: [
          {
            source: 'https://zulu.com/123.mpd',
            mimeType: 'application/dash+xml',
          },
        ],
      })
    })
    describe('when container is created', () => {
      describe('dash.js', () => {
        beforeEach(async () => {
          core.containers[0].playback.name = 'dash'
          plugin = new CmcdConfig(core)
          core.trigger(Events.CORE_CONTAINERS_CREATED)
          await new Promise((resolve) => setTimeout(resolve, 0))
        })
        it('should update DASH.js CMCD settings', () => {
          expect(core.containers[0].playback.options).toEqual(
            expect.objectContaining({
              dash: expect.objectContaining({
                cmcd: expect.objectContaining({
                  enabled: true,
                  enabledKeys: CMCD_KEYS,
                }),
              }),
            }),
          )
        })
        it('should generate unique session ID', () => {
          expect(core.containers[0].playback.options).toEqual(
            expect.objectContaining({
              dash: expect.objectContaining({
                cmcd: expect.objectContaining({
                  sid: '123',
                }),
              }),
            }),
          )
        })
        it('should compute content ID from source URL', () => {
          expect(core.containers[0].playback.options).toEqual(
            expect.objectContaining({
              dash: expect.objectContaining({
                cmcd: expect.objectContaining({
                  cid: '/123.mpd',
                }),
              }),
            }),
          )
        })
      })
      describe('hls.js', () => {
        beforeEach(async () => {
          core.containers[0].playback.name = 'hls'
          plugin = new CmcdConfig(core)
          core.trigger(Events.CORE_CONTAINERS_CREATED)
        })
        it('should update HLS.js CMCD settings', () => {
          expect(core.containers[0].playback.options).toEqual(
            expect.objectContaining({
              playback: expect.objectContaining({
                hlsjsConfig: expect.objectContaining({
                  cmcd: expect.objectContaining({
                    includeKeys: CMCD_KEYS,
                    contentId: '/123.mpd',
                    sessionId: '123',
                  }),
                }),
              }),
            }),
          )
        })
      })
    })
  })
  describe('custom content ID', () => {
    beforeEach(async () => {
      core = createMockCore({
        cmcd: {
          contentId:
            'e287ea99b57c09b7a185aaaf36e075f2c0b346ce90aeced72976b1732678a8c6',
        },
        sources: [
          {
            source: 'https://zulu.com/123.mpd',
            mimeType: 'application/dash+xml',
          },
        ],
      })
      core.containers[0].playback.name = 'dash'
      core.containers[0].playback.options.src = 'https://123.mpd'
      plugin = new CmcdConfig(core)
      core.trigger(Events.CORE_CONTAINERS_CREATED)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    it('should use custom content ID', () => {
      expect(core.containers[0].playback.options).toEqual(
        expect.objectContaining({
          dash: expect.objectContaining({
            cmcd: expect.objectContaining({
              cid: 'e287ea99b57c09b7a185aaaf36e075f2c0b346ce90aeced72976b1732678a8c6',
            }),
          }),
        }),
      )
    })
  })
  describe('custom session ID', () => {
    beforeEach(async () => {
      core = createMockCore({
        cmcd: { sessionId: '456' },
        sources: [
          {
            source: 'https://zulu.com/123.mpd',
            mimeType: 'application/dash+xml',
          },
        ],
      })
      core.containers[0].playback.name = 'dash'
      core.containers[0].playback.options.src = 'https://123.mpd'
      plugin = new CmcdConfig(core)
      core.trigger(Events.CORE_CONTAINERS_CREATED)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    it('should use custom session ID', () => {
      expect(core.containers[0].playback.options).toEqual(
        expect.objectContaining({
          dash: expect.objectContaining({
            cmcd: expect.objectContaining({
              sid: '456',
            }),
          }),
        }),
      )
    })
  })
})
