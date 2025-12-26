import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Events as CoreEvents } from '@clappr/core'
import FakeTimers from '@sinonjs/fake-timers'

import { ClapprStats } from '../ClapprStats'
import { createMockCore } from '../../../testUtils'
import {
  ClapprStatsChronograph,
  ClapprStatsCounter,
  ClapprStatsEvents,
} from '../types'

describe('ClapprStats', () => {
  let core: any
  let stats: ClapprStats
  let onReport: any
  let clock: FakeTimers.InstalledClock
  beforeEach(() => {
    core = createMockCore()
    stats = new ClapprStats(core.activeContainer)
    clock = FakeTimers.install()
  })
  afterEach(() => {
    clock.uninstall()
  })
  describe('time measurements', () => {
    describe('startup', () => {
      beforeEach(() => {
        vi.spyOn(performance, 'now').mockReturnValue(100)
        core.activeContainer.playback.emit(CoreEvents.PLAYBACK_PLAY_INTENT)
        vi.spyOn(performance, 'now').mockReturnValue(255)
        core.activeContainer.trigger(CoreEvents.CONTAINER_PLAY)
      })
      it('should measure', () => {
        const metrics = stats.exportMetrics()
        expect(metrics.chrono[ClapprStatsChronograph.Startup]).toBe(155)
        // expect(metrics.times[Chronograph.Session]).toBe(155)
      })
    })
    describe('watch', () => {
      beforeEach(() => {
        vi.spyOn(performance, 'now').mockReturnValue(100)
        core.activeContainer.playback.emit(CoreEvents.PLAYBACK_PLAY_INTENT)
        vi.spyOn(performance, 'now').mockReturnValue(150)
        core.activeContainer.trigger(CoreEvents.CONTAINER_PLAY)
        vi.spyOn(performance, 'now').mockReturnValue(3000)
        core.activeContainer.trigger(CoreEvents.CONTAINER_PAUSE)
        vi.spyOn(performance, 'now').mockReturnValue(4900)
        core.activeContainer.trigger(CoreEvents.CONTAINER_PLAY)
        vi.spyOn(performance, 'now').mockReturnValue(5900)
        core.activeContainer.trigger(CoreEvents.CONTAINER_PAUSE)
        vi.spyOn(performance, 'now').mockReturnValue(6900)
        core.activeContainer.trigger(CoreEvents.CONTAINER_PLAY)
      })
      it('should measure cumulative play and pause durations', () => {
        const metrics = stats.exportMetrics()
        expect(metrics.chrono[ClapprStatsChronograph.Watch]).toBe(3850)
        expect(metrics.chrono[ClapprStatsChronograph.Pause]).toBe(2900)
      })
    })
    describe('buffering', () => {
      beforeEach(() => {
        vi.spyOn(performance, 'now').mockReturnValue(100)
        core.activeContainer.playback.emit(CoreEvents.PLAYBACK_PLAY_INTENT)
        vi.spyOn(performance, 'now').mockReturnValue(150)
        core.activeContainer.trigger(CoreEvents.CONTAINER_PLAY)
        vi.spyOn(performance, 'now').mockReturnValue(250)
        core.activeContainer.trigger(CoreEvents.CONTAINER_STATE_BUFFERING)
        vi.spyOn(performance, 'now').mockReturnValue(350)
        core.activeContainer.trigger(CoreEvents.CONTAINER_STATE_BUFFERFULL)
        vi.spyOn(performance, 'now').mockReturnValue(450)
        core.activeContainer.trigger(CoreEvents.CONTAINER_STATE_BUFFERING)
        vi.spyOn(performance, 'now').mockReturnValue(550)
        core.activeContainer.trigger(CoreEvents.CONTAINER_STATE_BUFFERFULL)
      })
      it('should measure cumulative buffering durations', () => {
        const metrics = stats.exportMetrics()
        expect(metrics.chrono[ClapprStatsChronograph.Buffering]).toBe(200)
      })
    })
    describe('session', () => {
      beforeEach(() => {
        onReport = vi.fn()
        stats.on(ClapprStatsEvents.REPORT, onReport, null)
        vi.spyOn(performance, 'now').mockReturnValue(100)
        core.activeContainer.playback.emit(CoreEvents.PLAYBACK_PLAY_INTENT)
        vi.spyOn(performance, 'now').mockReturnValue(200)
        core.activeContainer.trigger(CoreEvents.CONTAINER_PLAY)
        vi.spyOn(performance, 'now').mockReturnValue(60300)
        core.activeContainer.trigger(CoreEvents.CONTAINER_STOP)
      })
      it('should measure', () => {
        expect(onReport).toHaveBeenCalledWith(
          expect.objectContaining({
            chrono: expect.objectContaining({
              [ClapprStatsChronograph.Session]: 60200,
            }),
          }),
        )
      })
    })
  })
  describe('fps measurements', () => {
    beforeEach(async () => {
      onReport = vi.fn()
      core.activePlayback.name = 'html5_video'
      stats.on(ClapprStatsEvents.REPORT, onReport, null)
      vi.spyOn(performance, 'now').mockReturnValue(100)
      core.activeContainer.playback.emit(CoreEvents.PLAYBACK_PLAY_INTENT)
      vi.spyOn(performance, 'now').mockReturnValue(200)
      vi.spyOn(performance, 'now').mockReturnValue(200)
      core.activeContainer.trigger(CoreEvents.CONTAINER_PLAY)
      core.activeContainer.playback.el.webkitDecodedFrameCount = 126
      core.activeContainer.playback.el.webkitDroppedFrameCount = 3
      vi.spyOn(performance, 'now').mockReturnValue(5225)
      await clock.tickAsync(5000)
      core.activeContainer.playback.el.webkitDecodedFrameCount = 275
      core.activeContainer.playback.el.webkitDroppedFrameCount = 4
      vi.spyOn(performance, 'now').mockReturnValue(10225)
      core.activeContainer.trigger(CoreEvents.CONTAINER_STOP)
    })
    it('should measure fps', () => {
      expect(onReport).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          counters: expect.objectContaining({
            [ClapprStatsCounter.DecodedFrames]: 126,
            [ClapprStatsCounter.DroppedFrames]: 3,
            [ClapprStatsCounter.Fps]: expect.closeTo(25, 0),
          }),
        }),
      )
      expect(onReport).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          counters: expect.objectContaining({
            [ClapprStatsCounter.DecodedFrames]: 275,
            [ClapprStatsCounter.DroppedFrames]: 4,
            [ClapprStatsCounter.Fps]: expect.closeTo(30, 0),
          }),
        }),
      )
    })
  })
})
