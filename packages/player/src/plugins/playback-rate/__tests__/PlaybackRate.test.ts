import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PlaybackRate } from '../PlaybackRate'
import {
  createMockBottomGear,
  createMockCore,
  createMockMediaControl,
} from '../../../testUtils'
import { Events } from '@clappr/core'
import { GearEvents } from '../../bottom-gear/BottomGear'
import { PlaybackType } from '../../../types'
// import { Logger, LogTracer, setTracer } from '@gcorevideo/utils'

// Logger.enable('*')
// setTracer(new LogTracer('PlaybackRate.test'))

describe('PlaybackRate', () => {
  let core: any
  let bottomGear: any
  let mediaControl: any
  let playbackRate: PlaybackRate
  beforeEach(() => {
    core = createMockCore()
    setupPlaybackType(core, 'vod')
    mediaControl = createMockMediaControl(core)
    bottomGear = createMockBottomGear(core)
    core.getPlugin.mockImplementation((name: string) => {
      if (name === 'bottom_gear') {
        return bottomGear
      }
      if (name === 'media_control') {
        return mediaControl
      }
      return null
    })
  })
  describe('basically', () => {
    beforeEach(() => {
      playbackRate = new PlaybackRate(core)
      core.emit(Events.CORE_READY)
      mediaControl.trigger(Events.MEDIACONTROL_RENDERED)
      bottomGear.trigger(GearEvents.RENDERED)
      setupPlaybackType(core, 'live')
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED)
    })
    it('should render', () => {
      expect(playbackRate.el.innerHTML).toMatchSnapshot()
    })
    it('should have normal rate initially', () => {
      expect(
        playbackRate.$el.find('[data-rate="1"]').parent().hasClass('current'),
      ).toBe(true)
      expect(
        playbackRate.$el.find('[data-rate="1"]').hasClass('gcore-skin-active'),
      ).toBe(true)
    })
    describe('until media source is loaded', () => {
      it('should not attach to the media control', () => {
        expect(bottomGear.addItem).not.toHaveBeenCalledWith(
          'rate',
          expect.anything(),
        )
      })
    })
    describe('after media source is loaded', () => {
      describe('when DVR is available', () => {
        beforeEach(() => {
          core.activePlayback.dvrEnabled = true
          core.activeContainer.isDvrEnabled.mockReturnValue(true)
          core.activePlayback.emit(Events.PLAYBACK_LOADEDMETADATA)
          core.activeContainer.emit(Events.CONTAINER_LOADEDMETADATA)
        })
        it('should not attach to the media control immediately', () => {
          expect(bottomGear.addItem).not.toHaveBeenCalledWith(
            'rate',
            expect.anything(),
          )
        })
        it('should attach to the media control after a short delay', async () => {
          await new Promise((resolve) => setTimeout(resolve, 25))
          expect(bottomGear.addItem).toHaveBeenCalledWith(
            'rate',
            playbackRate.$el,
          )
          expect(
            bottomGear.$el.find('li[data-rate]').text(),
            // @ts-ignore
          ).toMatchPlaybackRateLabel('1x')
        })
      })
      describe('when DVR is not available', () => {
        beforeEach(() => {
          core.activePlayback.emit(Events.PLAYBACK_LOADEDMETADATA)
          core.activeContainer.emit(Events.CONTAINER_LOADEDMETADATA)
        })
        it('should not attach to the media control', () => {
          expect(bottomGear.addItem).not.toHaveBeenCalledWith(
            'rate',
            expect.anything(),
          )
        })
      })
    })
    describe('on playback rate select', () => {
      beforeEach(async () => {
        core.activePlayback.dvrEnabled = true
        core.activeContainer.isDvrEnabled.mockReturnValue(true)
        core.activePlayback.emit(Events.PLAYBACK_LOADEDMETADATA)
        core.activeContainer.emit(Events.CONTAINER_LOADEDMETADATA)
        await new Promise((resolve) => setTimeout(resolve, 25))
      })
      describe.each([[2], [1.5], [1.25], [0.75], [0.5]])('%s', (rate) => {
        beforeEach(() => {
          playbackRate.$el.find(`[data-rate="${rate}"]`).click()
        })
        it('should set the selected rate', () => {
          expect(core.activePlayback.setPlaybackRate).toHaveBeenCalledWith(rate)
        })
        it('should highlight the selected rate', () => {
          expect(
            playbackRate.$el
              .find(`[data-rate="${rate}"]`)
              .parent()
              .hasClass('current'),
          ).toBe(true)
          expect(
            playbackRate.$el
              .find(`[data-rate="${rate}"]`)
              .hasClass('gcore-skin-active'),
          ).toBe(true)
        })
        it('should update the gear box option label', () => {
          expect(
            bottomGear.$el.find('#playback-rate-button').text(),
            // @ts-ignore
          ).toMatchPlaybackRateLabel(`${rate}x`)
        })
      })
    })
    describe('on go back', () => {
      beforeEach(async () => {
        playbackRate.$el.find('#playback-rate-back-button').click()
        return new Promise((resolve) => setTimeout(resolve, 0))
      })
      it('should refresh the bottom gear', () => {
        expect(bottomGear.refresh).toHaveBeenCalled()
      })
    })
  })
  describe('options.defaultValue', () => {
    beforeEach(async () => {
      core.options.playbackRate = {
        defaultValue: 1.5,
      }
      playbackRate = new PlaybackRate(core)
      core.emit(Events.CORE_READY)
      mediaControl.trigger(Events.MEDIACONTROL_RENDERED)
      setupPlaybackType(core, 'live')
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED)
      bottomGear.trigger(GearEvents.RENDERED)
      core.activePlayback.dvrEnabled = true
      core.activeContainer.isDvrEnabled.mockReturnValue(true)
      core.activePlayback.emit(Events.PLAYBACK_LOADEDMETADATA)
      core.activeContainer.emit(Events.CONTAINER_LOADEDMETADATA)
      await new Promise((resolve) => setTimeout(resolve, 25))
    })
    it('should set the selected rate to the defaultValue', () => {
      expect(core.activePlayback.setPlaybackRate).toHaveBeenCalledWith(1.5)
    })
    it('should highlight the selected rate', () => {
      expect(
        playbackRate.$el.find('[data-rate="1.5"]').parent().hasClass('current'),
      ).toBe(true)
      expect(
        playbackRate.$el
          .find('[data-rate="1.5"]')
          .hasClass('gcore-skin-active'),
      ).toBe(true)
    })
    it('should render proper gear box option label', () => {
      expect(
        bottomGear.$el.find('#playback-rate-button').text(),
        // @ts-ignore
      ).toMatchPlaybackRateLabel('1.5x')
    })
  })
})

expect.extend({
  toMatchPlaybackRateLabel(received, expected) {
    const { isNot } = this
    return {
      pass: received
        .replace(/\/assets.*\.svg/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .includes(`playback_rate ${expected}`),
      message: () => `${received} does${isNot ? '' : ' not'} match ${expected}`,
    }
  },
})

function setupPlaybackType(core: any, type: PlaybackType) {
  core.activePlayback.getPlaybackType.mockReturnValue(type)
  core.activeContainer.getPlaybackType.mockReturnValue(type)
  core.getPlaybackType.mockReturnValue(type)
}
