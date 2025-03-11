import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaControl, MediaControlElement } from '../MediaControl'
import { createMockCore } from '../../../testUtils'
import { LogTracer, Logger, setTracer } from '@gcorevideo/utils'
import { Events, Playback } from '@clappr/core'

Logger.enable('*')
setTracer(new LogTracer('MediaControl.test'))

describe('MediaControl', () => {
  let core: any
  let mediaControl: MediaControl

  beforeEach(() => {
    core = createMockCore()
  })
  describe('playback type', () => {
    beforeEach(() => {
      mediaControl = new MediaControl(core)
      core.emit('core:ready')
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
    })
    describe('when live', () => {
      beforeEach(() => {
        core.activeContainer.getPlaybackType.mockReturnValue(Playback.LIVE)
        core.activeContainer.emit(Events.CONTAINER_LOADEDMETADATA)
      })
      it('should apply live style class', () => {
        expect(mediaControl.$el.hasClass('live')).toBe(true)
      })
    })
    describe('when vod', () => {
      beforeEach(() => {
        core.activeContainer.getPlaybackType.mockReturnValue(Playback.VOD)
        core.activeContainer.emit(Events.CONTAINER_LOADEDMETADATA)
      })
      it('should not apply live style class', () => {
        expect(mediaControl.$el.hasClass('live')).toBe(false)
      })
    })
  })
  describe('putElement', () => {
    beforeEach(() => {
      mediaControl = new MediaControl(core)
      core.emit('core:ready')
      core.activeContainer.settings = {}
      core.emit('core:active:container:changed', core.activeContainer)
    })
    describe.each([
      ['pip' as MediaControlElement],
      ['gear' as MediaControlElement],
      ['cc' as MediaControlElement],
      // ['multicamera' as MediaControlElement],
      // ['playbackrate' as MediaControlElement],
      // ['vr' as MediaControlElement],
      // ['audiotracks' as MediaControlElement],
      // dvr controls
    ])('%s', (mcName) => {
      it('should put the element in the right panel', () => {
        const element = document.createElement('div')
        element.className = 'my-media-control'
        element.textContent = 'test'
        mediaControl.putElement(mcName, element)

        expect(mediaControl.el.innerHTML).toMatchSnapshot()
        expect(mediaControl.$el.find('.media-control-right-panel .my-media-control').length).toEqual(1)
      })
    })
  })
  describe('updateSettings', () => {
    beforeEach(() => {
      mediaControl = new MediaControl(core)
      core.emit('core:ready')
    })
    describe('dvr', () => {
      beforeEach(() => {
        core.activeContainer.settings = {
          left: ['playpause', 'position', 'duration'],
          seekEnabled: true,
        }
        core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
      })
      describe('when enabled', () => {
        beforeEach(() => {
          core.activePlayback.dvrEnabled = true
          core.activeContainer.isDvrEnabled.mockReturnValue(true)
          core.activeContainer.emit(Events.CONTAINER_SETTINGSUPDATE, true)
        })
        it('should enable DVR controls', () => {
          const element = document.createElement('div')
          element.className = 'my-dvr-controls'
          element.textContent = 'live'
          mediaControl.putElement('dvr', element)
          expect(mediaControl.el.innerHTML).toMatchSnapshot()
          expect(mediaControl.$el.find('.media-control-left-panel .my-dvr-controls').length).toEqual(1)
        })
      })
      describe('when disabled', () => {
        it('should disable DVR controls', () => {
          const element = document.createElement('div')
          element.className = 'my-dvr-controls'
          element.textContent = 'live'
          mediaControl.putElement('dvr', element)
          expect(mediaControl.el.innerHTML).toMatchSnapshot()
          expect(mediaControl.$el.find('.media-control-left-panel .my-dvr-controls').length).toEqual(0)
        })
      })
    })
  })
  describe('dvr mode', () => {
    beforeEach(() => {
      mediaControl = new MediaControl(core)
      core.emit(Events.CORE_READY)
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
    })
    describe('by default', () => {
      it('should not apply DVR style class', () => {
        expect(mediaControl.$el.hasClass('dvr')).toBe(false)
      })
    })
    describe('when in use', () => {
      beforeEach(() => {
        core.activeContainer.isDvrInUse.mockReturnValue(true)
        core.activePlayback.dvrInUse = true
        core.activeContainer.emit(Events.CONTAINER_PLAYBACKDVRSTATECHANGED, true)
      })
      it('should apply DVR style class', () => {
        expect(mediaControl.$el.hasClass('dvr')).toBe(true)
      })
    })
  })
})
