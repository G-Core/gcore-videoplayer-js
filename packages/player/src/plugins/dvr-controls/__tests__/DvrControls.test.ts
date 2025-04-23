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
    core.emit(Events.CORE_READY)
    mediaControl.trigger(Events.MEDIACONTROL_RENDERED)
    core.trigger(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
  })
  describe('basically', () => {
    it('should render', () => {
      expect(dvrControls.el.innerHTML).toMatchSnapshot()
      expect(dvrControls.el.textContent).toMatch(/\blive\b/)
      expect(dvrControls.el.textContent).toMatch(/\bback_to_live\b/)
    })
  })
  describe('while playback type is unknown', () => {
    it('should not mount', () => {
      expect(mediaControl.slot).not.toHaveBeenCalledWith('dvr', dvrControls.$el)
    })
  })
  describe('live stream', () => {
    beforeEach(() => {
      core.getPlaybackType.mockReturnValue('live')
      core.activeContainer.getPlaybackType.mockReturnValue('live')
      core.activePlayback.getPlaybackType.mockReturnValue('live')
    })
    describe.each([
      ['no DVR', false, false, false],
      ['DVR at live edge', true, false, false],
    ])('%s', (_, dvrEnabled, dvrInUse) => {
      beforeEach(() => {
        core.activePlayback.dvrEnabled = dvrEnabled
        core.activeContainer.isDvrEnabled.mockReturnValue(dvrEnabled)
        core.activePlayback.emit(Events.PLAYBACK_LOADEDMETADATA)
        core.activeContainer.emit(Events.CONTAINER_LOADEDMETADATA)
        if (dvrInUse) {
          core.activePlayback.dvrInUse = true
          core.activeContainer.isDvrInUse.mockReturnValue(true)
          core.activeContainer.emit(
            Events.CONTAINER_PLAYBACKDVRSTATECHANGED,
            true,
          )
        }
      })
      // TODO let the media control itself handle this
      it('should hide duration and position indicators', () => {
        expect(mediaControl.toggleElement).toHaveBeenCalledWith(
          'duration',
          false,
        )
        expect(mediaControl.toggleElement).toHaveBeenCalledWith(
          'position',
          false,
        )
      })
      it('should mount to the media control', () => {
        expect(mediaControl.mount).toHaveBeenCalledWith('left', dvrControls.$el)
      })
      if (dvrEnabled) {
        if (dvrInUse) {
          it('should show back_to_live button', () => {
            expect(
              dvrControls.$el.find('#gplayer-mc-back-to-live').css('display'),
            ).not.toBe('none')
          })
          it('should hide live indicator', () => {
            expect(
              dvrControls.$el.find('#gplayer-mc-live').css('display'),
            ).toBe('none')
          })
        } else {
          it('should show live indicator', () => {
            expect(
              dvrControls.$el.find('#gplayer-mc-live').css('display'),
            ).not.toBe('none')
          })
          it('should hide back_to_live button', () => {
            expect(
              dvrControls.$el.find('#gplayer-mc-back-to-live').css('display'),
            ).toBe('none')
          })
        }
      }
    })
    describe('when back_to_live button is clicked', () => {
      beforeEach(() => {
        core.activePlayback.dvrEnabled = true
        core.activeContainer.isDvrEnabled.mockReturnValue(true)
        core.activePlayback.emit(Events.PLAYBACK_LOADEDMETADATA)
        core.activeContainer.emit(Events.CONTAINER_LOADEDMETADATA)
        core.activeContainer.getDuration.mockReturnValue(180)
        core.activeContainer.emit(
          Events.CONTAINER_PLAYBACKDVRSTATECHANGED,
          true,
        )
        dvrControls.$el.find('#gplayer-mc-back-to-live').click()
      })
      it('should play stream', () => {
        expect(core.activeContainer.play).toHaveBeenCalled()
      })
      it('should seek to live edge', () => {
        expect(core.activeContainer.seek).toHaveBeenCalledWith(180)
      })
    })
  })
  describe('VOD stream', () => {
    beforeEach(() => {
      core.getPlaybackType.mockReturnValue(Playback.VOD)
      core.activeContainer.getPlaybackType.mockReturnValue(Playback.VOD)
      core.activePlayback.getPlaybackType.mockReturnValue(Playback.VOD)
      core.activePlayback.emit(Events.PLAYBACK_LOADEDMETADATA)
      core.activeContainer.emit(Events.CONTAINER_LOADEDMETADATA)
    })
    // TODO handle mount points in MediaControl
    it('should not mount', () => {
      expect(mediaControl.mount).not.toHaveBeenCalledWith(
        'left',
        expect.anything(),
      )
    })
    it('should not alter position and duration indicators', () => {
      expect(mediaControl.toggleElement).not.toHaveBeenCalledWith(
        'duration',
        false,
      )
      expect(mediaControl.toggleElement).not.toHaveBeenCalledWith(
        'position',
        false,
      )
    })
  })
})
