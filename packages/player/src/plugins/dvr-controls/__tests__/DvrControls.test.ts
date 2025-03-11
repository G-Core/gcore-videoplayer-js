import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DvrControls } from '../DvrControls.js'
import { createMockCore, createMockMediaControl } from '../../../testUtils.js'
import { Events, Playback } from '@clappr/core'
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
    ])('%s', (_, dvrEnabled, dvrInUse) => {
      beforeEach(() => {
        core.activePlayback.dvrEnabled = dvrEnabled
        core.activeContainer.isDvrEnabled.mockReturnValue(dvrEnabled)
        core.trigger(Events.CORE_READY)
        core.trigger(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
        if (dvrInUse) {
          core.activePlayback.dvrInUse = true
          core.activeContainer.isDvrInUse.mockReturnValue(true)
          core.activeContainer.emit(Events.CONTAINER_PLAYBACKDVRSTATECHANGED, true)
        }
      })
      it('should render', () => {
        expect(dvrControls.el.textContent).toBeTruthy()
        expect(dvrControls.el.innerHTML).toMatchSnapshot()
      })
      it('should hide duration and position indicators', () => {
        expect(mediaControl.toggleElement).toHaveBeenCalledWith('duration', false)
        expect(mediaControl.toggleElement).toHaveBeenCalledWith('position', false)
      })
      it('should render to the media control', () => {
        expect(mediaControl.putElement).toHaveBeenCalledWith('dvr', dvrControls.el)
      })
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
  describe('basically', () => {
    beforeEach(() => {
      core.getPlaybackType.mockReturnValue(Playback.VOD)
      core.activeContainer.getPlaybackType.mockReturnValue(Playback.VOD)
      core.activePlayback.getPlaybackType.mockReturnValue(Playback.VOD)
    })
    beforeEach(() => {
      core.trigger(Events.CORE_READY)
      core.trigger(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
    })
    it('should render', () => {
      expect(dvrControls.el.innerHTML).toMatchSnapshot()
      expect(dvrControls.el.textContent).toContain('live')
      expect(dvrControls.el.textContent).toContain('back_to_live')
    })
  })
})
