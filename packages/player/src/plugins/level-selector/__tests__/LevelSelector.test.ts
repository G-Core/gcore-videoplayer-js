import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UICorePlugin } from '@clappr/core'
import FakeTimers from '@sinonjs/fake-timers'
import { Logger, LogTracer, setTracer } from '@gcorevideo/utils'
import { LevelSelector } from '../LevelSelector.js'
import { createMockCore, createMockPlayback } from '../../../testUtils.js'

setTracer(new LogTracer('LevelSelector.test'))
Logger.enable('*')

const LEVELS = [
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
]
describe('LevelSelector', () => {
  let clock: FakeTimers.InstalledClock
  let core: any
  let levelSelector: LevelSelector
  let activePlayback: any
  beforeEach(() => {
    clock = FakeTimers.install()
  })
  afterEach(() => {
    clock.uninstall()
  })
  describe('basically', () => {
    beforeEach(() => {
      // const activeContainer = createMockContainer()
      let mediaControl: UICorePlugin | null = null
      let bottomGear: UICorePlugin | null = null
      // TODO create mock core
      core = createMockCore({
        levelSelector: {
          // restrictResolution: 360,
          labels: { 360: '360p', 720: 'HD' },
        },
      })
      activePlayback = core.activePlayback
      core.getPlugin.mockImplementation((name: string) => {
        if (name === 'media_control') {
          return mediaControl
        }
        if (name === 'bottom_gear') {
          return bottomGear
        }
        return null
      })
      mediaControl = createMediaControl(core)
      bottomGear = createBottomGear(core)
      levelSelector = new LevelSelector(core)
    })
    describe('initially', () => {
      beforeEach(async () => {
        core.emit('core:active:container:changed')
        await clock.tickAsync(1)
        activePlayback.emit('playback:levels:available', LEVELS)
        await clock.tickAsync(1)
      })
      it('should render proper level label', () => {
        // @ts-ignore
        expect(levelSelector.el.textContent).toMatchQualityLevelLabel('Auto')
      })
    })
    describe.each([
      ['auto', LEVELS, -1, 'Auto'],
      ['standard label', LEVELS, 0, '360p'],
      ['custom label', LEVELS, 1, 'HD'],
    ])('%s', (_, levels, current, label) => {
      beforeEach(async () => {
        core.emit('core:active:container:changed')
        await clock.tickAsync(1)
        // activePlayback.currentLevel = current
        activePlayback.emit('playback:levels:available', levels)
        await clock.tickAsync(1)
        levelSelector.$el.find('.gear-option').click()
        await clock.tickAsync(1)
        levelSelector.$el
          .find(`.gear-sub-menu_btn[data-id="${current}"]`)
          .click()
        await clock.tickAsync(1)
      })
      it('should render the proper level labels', () => {
        expect(levelSelector.el.innerHTML).toMatchSnapshot()
      })
      it('should render the selected level', () => {
        expect(
          levelSelector.$el.find('ul.gear-sub-menu .current')[0].textContent,
          // @ts-ignore
        ).toMatchQualityLevelOption(label)
      })
    })
  })
  describe('options.restrictResolution', () => {
    beforeEach(() => {
      let mediaControl: UICorePlugin | null = null
      let bottomGear: UICorePlugin | null = null
      core = createMockCore({
        levelSelector: {
          restrictResolution: 360,
          labels: { 360: '360p', 720: '720p' },
        },
      })
      activePlayback = core.activePlayback
      core.getPlugin.mockImplementation((name: string) => {
        if (name === 'media_control') {
          return mediaControl
        }
        if (name === 'bottom_gear') {
          return bottomGear
        }
        return null
      })
      mediaControl = createMediaControl(core)
      bottomGear = createBottomGear(core)
      levelSelector = new LevelSelector(core)
    })
    describe('basically', () => {
      beforeEach(async () => {
        core.emit('core:active:container:changed')
        await clock.tickAsync(1)
        activePlayback.emit('playback:levels:available', LEVELS)
        await clock.tickAsync(1)
      })
      it('should render the restricted quality level label', () => {
        expect(
          levelSelector.el.textContent,
          // @ts-ignore
        ).toMatchQualityLevelLabel('360p')

        expect(levelSelector.el.innerHTML).toMatchSnapshot()
      })
    })
    describe('given vertical video format levels', () => {
      beforeEach(async () => {
        core.emit('core:active:container:changed')
        await clock.tickAsync(1)
        activePlayback.emit('playback:levels:available', [
          {
            level: 0,
            width: 360,
            height: 640,
            bitrate: 450000,
          },
          {
            level: 1,
            width: 720,
            height: 1280,
            bitrate: 150000,
          },
          {
            level: 2,
            width: 1920,
            height: 1080,
            bitrate: 250000,
          },
        ])
        await clock.tickAsync(1)
        levelSelector.$el.find('.gear-option').click()
        await clock.tickAsync(1)
      })
      it('should recognize vertical orientation', () => {
        expect(levelSelector.el.innerHTML).toMatchSnapshot()
        expect(levelSelector.el.innerHTML).toMatchSnapshot()
      })
      it('should properly apply the restriction', () => {
        expect(
          levelSelector.$el.find('li:not(.level-disabled)')[0].textContent,
          // @ts-ignore
        ).toMatchQualityLevelOption('360p')
      })
    })
  })
})

expect.extend({
  toMatchQualityLevelLabel(received, expected) {
    const { isNot } = this
    const rendered = received
      .replace('/assets/icons/new/arrow-right.svg', '')
      .replace(/\s+/g, ' ')
      .trim()
    return {
      pass: rendered.includes(`Quality ${expected}`),
      message: () =>
        `Quality label must${
          isNot ? ' not' : ''
        } be ${expected} in "${rendered}"`,
    }
  },
  toMatchQualityLevelOption(received, expected) {
    const { isNot } = this
    const rendered = received
      .replace('/assets/icons/new/check.svg', '')
      .replace(/\s+/g, ' ')
      .trim()
    return {
      pass: rendered === expected,
      message: () =>
        `Quality option must${
          isNot ? ' not' : ''
        } be ${expected} in "${rendered}"`,
    }
  },
})

function createMediaControl(core: any) {
  const mediaControl = new UICorePlugin(core)
  // @ts-ignore
  mediaControl.getElement = vi.fn().mockReturnValue(null)
  return mediaControl
}

function createBottomGear(core: any) {
  const bottomGear = new UICorePlugin(core)
  // @ts-ignore
  bottomGear.getElement = vi.fn().mockReturnValue(null)
  // @ts-ignore
  bottomGear.setContent = vi.fn()
  return bottomGear
}
