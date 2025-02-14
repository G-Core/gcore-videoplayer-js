import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UICorePlugin } from '@clappr/core'
import FakeTimers from '@sinonjs/fake-timers'
import EventLite from 'event-lite'
import { Logger, LogTracer, setTracer } from '@gcorevideo/utils'
import { LevelSelector } from '../LevelSelector.js'

setTracer(new LogTracer('LevelSelector.test'))
Logger.enable('*')

describe('LevelSelector', () => {
  let clock: FakeTimers.InstalledClock
  beforeEach(() => {
    clock = FakeTimers.install()
  })
  afterEach(() => {
    clock.uninstall()
  })
  describe('options.restrictResolution', () => {
    let core: any
    let levelSelector: LevelSelector
    beforeEach(async () => {
      const activeContainer = Object.assign(new EventLite(), {
        $el: {
          html: vi.fn(),
        },
      })
      const activePlayback = Object.assign(new EventLite(), {
        currentLevel: -1,
        levels: [],
      })
      core = Object.assign(new EventLite(), {
        activeContainer,
        activePlayback,
        options: {
          levelSelector: {
            restrictResolution: 360,
          },
        },
      })
      core.mediaControl = new UICorePlugin(core),
      levelSelector = new LevelSelector(core)
      core.emit('core:ready')
      await clock.tickAsync(1)
      activePlayback.emit('playback:levels:available', [
        {
          level: 0,
          height: 360,
          width: 640,
          bitrate: 300000,
        },
        {
          level: 1,
          height: 720,
          width: 1280,
          bitrate: 150000,
        },
        {
          level: 2,
          height: 1080,
          width: 1920,
          bitrate: 250000,
        },
      ])
      await clock.tickAsync(1)
    })
    it('should render the restricted quality level label', () => {
      expect(levelSelector.el.textContent?.replace('/assets/icons/new/arrow-right.svg', '').replace(/\s+/g, ' ')).toContain('Quality 360p')
      expect(levelSelector.el.innerHTML).toMatchSnapshot()
    })
  })
})
