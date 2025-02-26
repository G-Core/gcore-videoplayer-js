import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DvrControls } from '../DvrControls.js'
import { createMockCore, createMockMediaControl } from '../../../testUtils.js'
// import { LogTracer, Logger, setTracer } from '@gcorevideo/utils'

// setTracer(new LogTracer('DvrControls.test'))
// Logger.enable('*')

describe('DvrControls', () => {
  let core: any
  let mediaControl: any
  let plugins: Record<string, any> = {}
  let dvrControls: DvrControls
  beforeEach(() => {
    core = createMockCore()
    mediaControl = createMockMediaControl(core)
    plugins = {
      media_control: mediaControl,
    }
    core.getPlugin.mockImplementation((name: string) => plugins[name])
    dvrControls = new DvrControls(core)
    plugins.dvr_controls = dvrControls
  })
  describe('live stream', () => {
    beforeEach(() => {
      core.getPlaybackType.mockReturnValue('live')
    })
    describe.each([
      ['no DVR', false, false, false],
      ['DVR at live edge', true, false, false],
      ['DVR behind live edge', true, true, true],
    ])('%s', (_, dvrEnabled, dvrInUse, indicateDvr) => {
      beforeEach(() => {
        core.activePlayback.dvrEnabled = dvrEnabled
        core.trigger('core:ready')
        core.trigger('core:active:container:changed')
        if (dvrInUse) {
          core.activeContainer.trigger('container:dvr', true)
        }
      })
      it('should render', () => {
        expect(dvrControls.el.textContent).toBeTruthy()
        expect(dvrControls.el.innerHTML).toMatchSnapshot()
      })
      it('should render to the media control left panel', () => {
        expect(mediaControl.$el.find('.media-control-left-panel').text()).toContain('live')
        expect(mediaControl.el.innerHTML).toMatchSnapshot()
      })
      it('should indicate live streaming mode', () => {
        expect(mediaControl.$el.hasClass('live')).toBe(true)
      })
      if (indicateDvr) {
        it('should indicate DVR mode', () => {
          expect(mediaControl.$el.hasClass('dvr')).toBe(true)
        })
      } else {
        it('should not indicate DVR mode', () => {
          expect(mediaControl.$el.hasClass('dvr')).toBe(false)
        })
      }
    })
    describe('when back_to_live button is clicked', () => {
      beforeEach(() => {
        core.activePlayback.dvrEnabled = true
        core.trigger('core:ready')
        core.trigger('core:active:container:changed')
        core.activeContainer.getDuration.mockReturnValue(180)
        core.activeContainer.trigger('container:dvr', true)
        dvrControls.$el.find('.live-button').click()
      })
      it('should call active container play', () => {
        expect(core.activeContainer.play).toHaveBeenCalled()
      })
      it('should seek to live edge', () => {
        expect(core.activeContainer.seek).toHaveBeenCalledWith(180)
      })
    })
  })
  describe('VOD stream', () => {
    beforeEach(() => {
      core.getPlaybackType.mockReturnValue('vod')
    })
    beforeEach(() => {
      core.trigger('core:ready')
      core.trigger('core:active:container:changed')
    })
    it('should not render', () => {
      expect(dvrControls.el.textContent).toBeFalsy()
    })
  })
})
