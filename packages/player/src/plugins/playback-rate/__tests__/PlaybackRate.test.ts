import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PlaybackRate } from '../PlaybackRate'
import {
  createMockBottomGear,
  createMockCore,
  createMockMediaControl,
} from '../../../testUtils'
import { Events } from '@clappr/core'
import { GearEvents } from '../../bottom-gear/BottomGear'
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
    playbackRate = new PlaybackRate(core)
    core.emit(Events.CORE_READY)
    core.activePlayback.getPlaybackType.mockReturnValue('live')
    core.activeContainer.getPlaybackType.mockReturnValue('live')
    core.getPlaybackType.mockReturnValue('live')
    core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED)
    core.activePlayback.dvrEnabled = true
    core.activeContainer.isDvrEnabled.mockReturnValue(true)
    core.activeContainer.emit(Events.CONTAINER_LOADEDMETADATA)
    bottomGear.trigger(GearEvents.RENDERED)
  })
  it('should render', () => {
    expect(playbackRate.el.innerHTML).toMatchSnapshot()
    expect(bottomGear.addItem).toHaveBeenCalledWith('rate', playbackRate.$el)
    expect(
      bottomGear.$el.find('li[data-rate]').text(),
      // @ts-ignore
    ).toMatchPlaybackRateLabel('playback_rate 1x')
  })
  it('should have normal rate initially', () => {
    expect(
      playbackRate.$el.find('[data-rate="1"]').parent().hasClass('current'),
    ).toBe(true)
    expect(
      playbackRate.$el.find('[data-rate="1"]').hasClass('gcore-skin-active'),
    ).toBe(true)
  })
  describe('on playback rate select', () => {
    describe.each([[2], [1.5], [1.25], [1], [0.75], [0.5]])('%s', (rate) => {
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
        ).toMatchPlaybackRateLabel(`playback_rate ${rate}x`)
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

expect.extend({
  toMatchPlaybackRateLabel(received, expected) {
    const { isNot } = this
    return {
      pass:
        received
          .replace(/\/assets.*\.svg/g, '')
          .replace(/\s+/g, ' ')
          .trim().includes(expected),
      message: () => `${received} does${isNot ? '' : ' not'} match ${expected}`,
    }
  },
})
