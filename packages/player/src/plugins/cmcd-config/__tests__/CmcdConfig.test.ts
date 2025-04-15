import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CmcdConfig } from '../CmcdConfig'
import { createMockCore } from '../../../testUtils'
import { Events } from '@clappr/core'
import { generateContentId } from '../utils'

import { createHash } from 'node:crypto'

vi.mock('../utils', () => ({
  generateSessionId: vi.fn().mockReturnValue('123'),
  generateContentId: vi.fn().mockResolvedValue('deadbeef'),
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
      core = createMockCore({})
    })
    describe('when active container is changed', () => {
      describe('dash.js', () => {
        beforeEach(async () => {
          core.activeContainer.playback.name = 'dash'
          core.activeContainer.playback.options.src = 'https://123.mpd'
          plugin = new CmcdConfig(core)
          core.trigger(Events.CORE_ACTIVE_CONTAINER_CHANGED)
          await new Promise(resolve => setTimeout(resolve, 0))
        })
        it('should update DASH.js CMCD settings', () => {
          expect(core.activePlayback.options).toEqual(expect.objectContaining({
            dash: expect.objectContaining({
              cmcd: expect.objectContaining({
                enabled: true,
                enabledKeys: CMCD_KEYS,
              })
            })
          }))
        })
        it('should generate unique session ID', () => {
          expect(core.activePlayback.options).toEqual(expect.objectContaining({
            dash: expect.objectContaining({
              cmcd: expect.objectContaining({
                sid: '123',
              })
            })
          }))
        })
        it('should compute content ID from source URL', () => {
          expect(generateContentId).toHaveBeenCalledWith('https://123.mpd')
          expect(core.activePlayback.options).toEqual(expect.objectContaining({
            dash: expect.objectContaining({
              cmcd: expect.objectContaining({
                cid: 'deadbeef',
              })
            })
          }))
        })
      })
      describe('hls.js', () => {
        beforeEach(async () => {
          core.activeContainer.playback.name = 'hls'
          core.activeContainer.playback.options.src = 'https://123.m3u8'
          plugin = new CmcdConfig(core)
          await new Promise(resolve => setTimeout(resolve, 0))
          core.trigger(Events.CORE_ACTIVE_CONTAINER_CHANGED)
          await new Promise(resolve => setTimeout(resolve, 0))
        })
        it('should update HLS.js CMCD settings', () => {
          expect(core.activePlayback.options).toEqual(expect.objectContaining({
            playback: expect.objectContaining({
              hlsjsConfig: expect.objectContaining({
                cmcd: expect.objectContaining({
                  includeKeys: CMCD_KEYS,
                  contentId: 'deadbeef',
                  sessionId: '123',
                })
              })
            })
          }))
          expect(generateContentId).toHaveBeenCalledWith('https://123.m3u8')
        })
      })
    })
  })
  describe('custom content ID', () => {
    beforeEach(async () => {
      core = createMockCore({
        cmcd: {
          contentId: (src: string) => new Promise(resolve => {
            const h = createHash('sha256')
            h.on('readable', () => {
              const data = h.read()
              if (data) {
                resolve(data.toString('hex'))
              }
            })
            h.update(Buffer.from('1$' + src))
            h.end()
          }),
        }
      })
      core.activePlayback.name = 'dash'
      core.activePlayback.options.src = 'https://123.mpd'
      plugin = new CmcdConfig(core)
      core.trigger(Events.CORE_ACTIVE_CONTAINER_CHANGED)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    it('should use custom content ID', () => {
      expect(core.activePlayback.options).toEqual(expect.objectContaining({
        dash: expect.objectContaining({
          cmcd: expect.objectContaining({
            cid: 'e287ea99b57c09b7a185aaaf36e075f2c0b346ce90aeced72976b1732678a8c6',
          })
        })
      }))
    })
  })
  describe('custom session ID', () => {
    beforeEach(async () => {
      core = createMockCore({
        cmcd: { sessionId: '456' },
      })
      core.activePlayback.name = 'dash'
      core.activePlayback.options.src = 'https://123.mpd'
      plugin = new CmcdConfig(core)
      core.trigger(Events.CORE_ACTIVE_CONTAINER_CHANGED)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    it('should use custom session ID', () => {
      expect(core.activePlayback.options).toEqual(expect.objectContaining({
        dash: expect.objectContaining({
          cmcd: expect.objectContaining({
            sid: '456',
          })
        })
      }))
    })
  })
})
