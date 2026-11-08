import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Events } from '@clappr/core'

import { PlaybackStats } from '../PlaybackStats.js'
import { createMockContainer } from '../../../testUtils.js'

describe('PlaybackStats', () => {
  let container: any
  let plugin: PlaybackStats
  let now: number

  const advance = (ms: number) => {
    now += ms
    vi.advanceTimersByTime(ms)
  }

  beforeEach(() => {
    now = 1000
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    container = createMockContainer()
    container.statsReport = vi.fn()
    plugin = new PlaybackStats(container)
  })

  afterEach(() => {
    plugin.destroy()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // The order of events emitted by the HTML5-based playbacks
  function startPlayback(startupMs = 500) {
    container.playback.trigger(Events.PLAYBACK_PLAY_INTENT)
    container.trigger(Events.CONTAINER_STATE_BUFFERING)
    advance(startupMs)
    container.trigger(Events.CONTAINER_STATE_BUFFERFULL)
    container.playback.trigger(Events.PLAYBACK_PLAY)
  }

  it('excludes startup buffering from watching time and rebuffers', () => {
    startPlayback(500)
    advance(3000)
    expect(plugin.getStats()).toMatchObject({
      startupTime: 500,
      watchingTime: 3000,
      rebuffers: 0,
      rebufferingTime: 0,
    })
  })

  describe('startup time', () => {
    it('is measured without startup buffering events', () => {
      container.playback.trigger(Events.PLAYBACK_PLAY_INTENT)
      advance(300)
      container.playback.trigger(Events.PLAYBACK_PLAY)
      advance(2000)
      container.trigger(Events.CONTAINER_STATE_BUFFERING)
      advance(1000)
      container.trigger(Events.CONTAINER_STATE_BUFFERFULL)
      expect(plugin.getStats()).toMatchObject({
        startupTime: 300,
        rebuffers: 1,
        rebufferingTime: 1000,
        watchingTime: 2000,
      })
    })

    it('is measured from the last play request', () => {
      // autoplay blocked by the browser
      container.playback.trigger(Events.PLAYBACK_PLAY_INTENT)
      advance(30000)
      // the viewer clicks play
      container.playback.trigger(Events.PLAYBACK_PLAY_INTENT)
      advance(400)
      container.playback.trigger(Events.PLAYBACK_PLAY)
      expect(plugin.getStats().startupTime).toBe(400)
    })

    it('ignores buffering before the play request', () => {
      // preloading
      container.trigger(Events.CONTAINER_STATE_BUFFERING)
      advance(2000)
      container.trigger(Events.CONTAINER_STATE_BUFFERFULL)
      advance(10000)
      startPlayback(500)
      expect(plugin.getStats()).toMatchObject({
        startupTime: 500,
        rebuffers: 0,
        rebufferingTime: 0,
        watchingTime: 0,
      })
    })
  })

  it('excludes rebuffering from watching time', () => {
    startPlayback()
    advance(2000)
    container.trigger(Events.CONTAINER_STATE_BUFFERING)
    advance(4000)
    expect(plugin.getStats()).toMatchObject({
      watchingTime: 2000,
      rebufferingTime: 4000,
    })
    container.trigger(Events.CONTAINER_STATE_BUFFERFULL)
    advance(1000)
    expect(plugin.getStats()).toMatchObject({
      watchingTime: 3000,
      rebufferingTime: 4000,
    })
  })

  it('keeps watching time across pause and resume', () => {
    startPlayback()
    advance(2000)
    container.trigger(Events.CONTAINER_STATE_BUFFERING)
    advance(10000)
    container.trigger(Events.CONTAINER_STATE_BUFFERFULL)
    advance(1000)
    container.playback.trigger(Events.PLAYBACK_PAUSE)
    advance(40000)
    expect(plugin.getStats().watchingTime).toBe(3000)

    container.playback.trigger(Events.PLAYBACK_PLAY)
    advance(5000)
    const stats = plugin.getStats()
    expect(stats.watchingTime).toBe(8000)
    expect(stats.rebufferingTime).toBe(10000)
  })

  it('does not count buffering while paused as watching time', () => {
    startPlayback()
    advance(1000)
    container.playback.trigger(Events.PLAYBACK_PAUSE)
    container.trigger(Events.CONTAINER_STATE_BUFFERING)
    advance(2000)
    container.trigger(Events.CONTAINER_STATE_BUFFERFULL)
    advance(2000)
    expect(plugin.getStats().watchingTime).toBe(1000)
  })

  describe('on pause', () => {
    beforeEach(() => {
      startPlayback()
      advance(12000) // two periodic reports
      container.statsReport.mockClear()
      container.playback.trigger(Events.PLAYBACK_PAUSE)
    })

    it('sends a final report', () => {
      expect(container.statsReport).toHaveBeenCalledTimes(1)
      expect(container.statsReport).toHaveBeenCalledWith(
        expect.objectContaining({ watchingTime: 12000 }),
      )
    })

    it('stops periodic reports until playback resumes', () => {
      container.statsReport.mockClear()
      advance(20000)
      expect(container.statsReport).not.toHaveBeenCalled()

      container.playback.trigger(Events.PLAYBACK_PLAY)
      advance(5000)
      expect(container.statsReport).toHaveBeenCalledTimes(1)
      expect(container.statsReport).toHaveBeenCalledWith(
        expect.objectContaining({ watchingTime: 17000 }),
      )
    })

    it('ignores buffering while paused', () => {
      container.trigger(Events.CONTAINER_STATE_BUFFERING)
      advance(3000)
      container.trigger(Events.CONTAINER_STATE_BUFFERFULL)
      expect(plugin.getStats()).toMatchObject({
        rebuffers: 0,
        rebufferingTime: 0,
        watchingTime: 12000,
      })
    })

    it('does not report again when playback ends', () => {
      container.statsReport.mockClear()
      container.trigger(Events.CONTAINER_ENDED)
      expect(container.statsReport).not.toHaveBeenCalled()
    })
  })

  it('closes an ongoing stall on pause', () => {
    startPlayback()
    advance(1000)
    container.trigger(Events.CONTAINER_STATE_BUFFERING)
    advance(2000)
    container.playback.trigger(Events.PLAYBACK_PAUSE)
    advance(10000)
    container.trigger(Events.CONTAINER_STATE_BUFFERFULL)
    expect(plugin.getStats()).toMatchObject({
      rebuffers: 1,
      rebufferingTime: 2000,
      watchingTime: 1000,
    })
  })

  it('stops periodic reports when destroyed', () => {
    startPlayback()
    advance(1000)
    plugin.destroy()
    container.statsReport.mockClear()
    advance(20000)
    expect(container.statsReport).not.toHaveBeenCalled()
  })

  it('reads the report interval from the player options', () => {
    plugin.destroy()
    container = createMockContainer({ reportInterval: 10000 })
    container.statsReport = vi.fn()
    plugin = new PlaybackStats(container)
    startPlayback()
    advance(9000)
    expect(container.statsReport).not.toHaveBeenCalled()
    advance(1000)
    expect(container.statsReport).toHaveBeenCalledTimes(1)
  })

  it('stops counting watching time on stop', () => {
    startPlayback()
    advance(1500)
    container.trigger(Events.CONTAINER_STOP)
    advance(5000)
    expect(plugin.getStats().watchingTime).toBe(1500)
    expect(container.statsReport).toHaveBeenCalledWith(
      expect.objectContaining({ watchingTime: 1500 }),
    )
  })
})
