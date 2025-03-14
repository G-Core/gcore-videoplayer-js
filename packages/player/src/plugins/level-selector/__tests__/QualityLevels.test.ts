import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Events } from '@clappr/core'
import { QualityLevels } from '../QualityLevels.js'
import {
  createMockBottomGear,
  createMockCore,
  createMockMediaControl,
} from '../../../testUtils.js'
import { GearEvents } from '../../bottom-gear/BottomGear.js'
// import { Logger, LogTracer, setTracer } from '@gcorevideo/utils'

// setTracer(new LogTracer('LevelSelector.test'))
// Logger.enable('*')

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

describe('QualityLevels', () => {
  let core: any
  let levelSelector: QualityLevels
  let mediaControl: any
  let bottomGear: any
  describe('basically', () => {
    beforeEach(() => {
      core = createMockCore({
        levelSelector: {
          // restrictResolution: 360,
          labels: { 720: 'HD', 1080: 'Full HD' },
        },
      })
      core.getPlugin.mockImplementation((name: string) => {
        if (name === 'media_control') {
          return mediaControl
        }
        if (name === 'bottom_gear') {
          return bottomGear
        }
        return null
      })
      mediaControl = createMockMediaControl(core)
      bottomGear = createMockBottomGear(core)
      levelSelector = new QualityLevels(core)
    })
    describe('initially', () => {
      beforeEach(() => {
        core.emit(Events.CORE_READY)
        core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED)
        bottomGear.trigger(GearEvents.RENDERED)
        core.activePlayback.emit(Events.PLAYBACK_LEVELS_AVAILABLE, LEVELS)
      })
      it('should render proper level label', () => {
        expect(
          bottomGear.$el.find('[data-quality]').text(),
          // @ts-ignore
        ).toMatchQualityLevelLabel('auto')
      })
    })
    describe.each([
      ['auto', LEVELS, -1, 'auto'],
      ['standard label', LEVELS, 0, '360p'],
      ['custom label', LEVELS, 1, 'HD'],
    ])('%s', (_, levels, current, label) => {
      beforeEach(() => {
        core.emit(Events.CORE_READY)
        core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED)
        bottomGear.trigger(GearEvents.RENDERED)
        core.activePlayback.emit(Events.PLAYBACK_LEVELS_AVAILABLE, levels)
        levelSelector.$el
          .find(`#level-selector-menu [data-id="${current}"]`)
          .click()
      })
      it('should render the proper level label', () => {
        expect(
          bottomGear.$el.find('[data-quality]').text(),
          // @ts-ignore
        ).toMatchQualityLevelLabel(label)
      })
      it('should render the selected level', () => {
        expect(levelSelector.el.innerHTML).toMatchSnapshot()
        expect(
          levelSelector.$el.find('ul.gear-sub-menu .current')[0].textContent,
          // @ts-ignore
        ).toMatchQualityLevelOption(label)
      })
    })
  })
  describe('options.restrictResolution', () => {
    beforeEach(() => {
      core = createMockCore({
        levelSelector: {
          restrictResolution: 360,
          labels: { 360: '360p', 720: '720p', 1080: '1080p' },
        },
      })
      mediaControl = createMockMediaControl(core)
      bottomGear = createMockBottomGear(core)
      core.getPlugin.mockImplementation((name: string) => {
        if (name === 'media_control') {
          return mediaControl
        }
        if (name === 'bottom_gear') {
          return bottomGear
        }
        return null
      })
      mediaControl = createMockMediaControl(core)
      bottomGear = createMockBottomGear(core)
      levelSelector = new QualityLevels(core)
      core.emit(Events.CORE_READY)
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
      bottomGear.trigger(GearEvents.RENDERED)
    })
    describe('initially', () => {
      beforeEach(() => {
        core.activePlayback.emit(Events.PLAYBACK_LEVELS_AVAILABLE, LEVELS)
      })
      it('should render the restricted quality level label', () => {
        expect(bottomGear.$el.find('[data-quality]').html()).toMatchSnapshot()
        expect(
          bottomGear.$el.find('[data-quality]').text(),
          // @ts-ignore
        ).toMatchQualityLevelLabel('360p')
        expect(
          levelSelector.$el.find('#level-selector-menu .current').text(),
          // @ts-ignore
        ).toMatchQualityLevelOption('360p')
      })
      describe('when opened', () => {
        beforeEach(() => {
          bottomGear.$el.find('[data-quality]').click()
        })
        it('should render the restricted level items disabled', () => {
          expect(levelSelector.el.innerHTML).toMatchSnapshot()
          const allItems = levelSelector.$el.find('#level-selector-menu li')
          expect(allItems.length).toBe(3)
          const unrestrictedItems = allItems.filter(':not(.disabled)')
          expect(unrestrictedItems.length).toBe(1)
          // @ts-ignore
          expect(unrestrictedItems.text()).toMatchQualityLevelOption('360p')
        })
      })
    })
    describe('given vertical video format levels', () => {
      beforeEach(() => {
        core.activePlayback.emit(Events.PLAYBACK_LEVELS_AVAILABLE, [
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
            width: 1080,
            height: 1920,
            bitrate: 250000,
          },
        ])
      })
      it('should recognize vertical orientation', () => {
        expect(levelSelector.el.innerHTML).toMatchSnapshot()
        expect(
          levelSelector.$el.find('#level-selector-menu [data-id]:eq(0)').text(),
          // @ts-ignore
        ).toMatchQualityLevelOption('1080p')
        expect(
          levelSelector.$el.find('#level-selector-menu [data-id]:eq(1)').text(),
          // @ts-ignore
        ).toMatchQualityLevelOption('720p')
        expect(
          levelSelector.$el.find('#level-selector-menu [data-id]:eq(2)').text(),
          // @ts-ignore
        ).toMatchQualityLevelOption('360p')
      })
      it('should properly apply the restriction', () => {
        expect(
          levelSelector.$el.find('#level-selector-menu li:not(.disabled)')[0]
            .textContent,
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
      .replace(/\/assets\/.*\.svg/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    return {
      pass: rendered.includes(`quality ${expected}`),
      message: () =>
        `Quality label must${
          isNot ? ' not' : ''
        } be ${expected} in "${rendered}"`,
    }
  },
  toMatchQualityLevelOption(received, expected) {
    const { isNot } = this
    const rendered = received
      .replace(/\/assets\/.*\.svg/g, '')
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
