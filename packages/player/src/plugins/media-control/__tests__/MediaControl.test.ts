import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MediaControl,
  MediaControlElement,
  MediaControlSettings,
} from '../MediaControl'
import { createMockCore } from '../../../testUtils'
import { LogTracer, Logger, setTracer } from '@gcorevideo/utils'
import { $, Events, Playback } from '@clappr/core'

vi.mock('../../utils/fullscreen', () => ({
  fullscreenEnabled: vi.fn().mockReturnValue(true),
  isFullscreen: vi.fn().mockReturnValue(false),
}))

Logger.enable('*')
setTracer(new LogTracer('MediaControl.test'))

describe('MediaControl', () => {
  let core: any
  let mediaControl: MediaControl

  beforeEach(() => {
    core = createMockCore()
  })
  describe('initially', () => {
    beforeEach(() => {
      mediaControl = new MediaControl(core)
      core.emit(Events.CORE_READY)
    })
    it('should not render', () => {
      expect(mediaControl.el.innerHTML).toBe('')
    })
  })
  describe('when container settings update', () => {
    beforeEach(() => {
      mediaControl = new MediaControl(core)
      core.emit(Events.CORE_READY)
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
      core.activePlayback.emit(Events.PLAYBACK_LOADEDMETADATA)
      core.activeContainer.emit(Events.CONTAINER_LOADEDMETADATA)
    })
    describe.each([
      [
        'vod',
        {
          left: ['playpause', 'position', 'duration'],
          default: ['seekbar'],
          right: ['fullscreen', 'volume', 'hd-indicator'],
          seekEnabled: true,
        } as MediaControlSettings,
      ],
    ])('%s', (_, settings: MediaControlSettings) => {
      beforeEach(() => {
        core.activeContainer.settings = settings
        core.activePlayback.emit(Events.PLAYBACK_SETTINGSUPDATE)
        core.activeContainer.emit(Events.CONTAINER_SETTINGSUPDATE)
      })
      it('should render', () => {
        expect(mediaControl.el.innerHTML).toMatchSnapshot()
      })
      it.each(
        settings.left
      )("should render %s control", (element) => {
        const el = mediaControl.$el.find(`.media-control-left-panel [data-${element}]`)
        expect(el.length).toEqual(1)
      })
      it.each(
        arraySubtract(['playpause', 'playstop', 'position', 'duration'], settings.left)
      )("should not render %s control", (element) => {
        const el = mediaControl.$el.find(`.media-control-left-panel [data-${element}]`)
        expect(el.length).toEqual(0)
      })
      it(`should ${settings.seekEnabled ? '' : 'not '}render the seek bar`, () => {
        const seekbar = mediaControl.$el.find('.media-control-center-panel [data-seekbar]')
        expect(seekbar.length).toBeGreaterThan(1)
        if (settings.seekEnabled) {
          expect(seekbar.hasClass('seek-disabled')).toBe(false)
        } else {
          expect(seekbar.hasClass('seek-disabled')).toBe(true)
        }
      })
      it(`should ${settings.right.includes('volume') ? '' : 'not '}render the volume control`, () => {
        const volume = mediaControl.$el.find('.drawer-container[data-volume]')
        if (settings.right.includes('volume')) {
          expect(volume.length).toEqual(1)
        } else {
          expect(volume.length).toEqual(0)
        }
      })
      it(`should ${settings.right.includes('fullscreen') ? '' : 'not '}render the fullscreen control`, () => {
        const fullscreen = mediaControl.$el.find('.media-control-right-panel [data-fullscreen]')
        if (settings.right.includes('fullscreen')) {
          expect(fullscreen.length).toEqual(1)
        } else {
          expect(fullscreen.length).toEqual(0)
        }
      })
    })
  })
  describe('playback type', () => {
    beforeEach(() => {
      mediaControl = new MediaControl(core)
      core.emit(Events.CORE_READY)
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
    })
    describe('when live', () => {
      beforeEach(() => {
        core.activeContainer.getPlaybackType.mockReturnValue(Playback.LIVE)
        core.activePlayback.getPlaybackType.mockReturnValue(Playback.LIVE)
        core.getPlaybackType.mockReturnValue(Playback.LIVE)
        core.activeContainer.emit(Events.CONTAINER_LOADEDMETADATA)
        core.activePlayback.emit(Events.PLAYBACK_LOADEDMETADATA)
        // TODO playback.settings
        core.activePlayback.emit(Events.PLAYBACK_SETTINGSUPDATE)
      })
      it('should apply live style class', () => {
        expect(mediaControl.$el.hasClass('live')).toBe(true)
      })
    })
    describe('when vod', () => {
      beforeEach(() => {
        core.activeContainer.getPlaybackType.mockReturnValue(Playback.VOD)
        core.activePlayback.getPlaybackType.mockReturnValue(Playback.VOD)
        core.getPlaybackType.mockReturnValue(Playback.VOD)
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
      ['audiotracks' as MediaControlElement],
      // dvr controls
    ])('%s', (mcName) => {
      it('should put the element in the right panel', () => {
        const element = document.createElement('div')
        element.className = 'my-media-control'
        element.textContent = 'test'
        mediaControl.putElement(mcName, $(element))

        expect(mediaControl.el.innerHTML).toMatchSnapshot()
        expect(
          mediaControl.$el.find('.media-control-right-panel .my-media-control')
            .length,
        ).toEqual(1)
      })
    })
  })
  describe('updateSettings', () => {
    beforeEach(() => {
      mediaControl = new MediaControl(core)
      core.emit(Events.CORE_READY)
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
          mediaControl.putElement('dvr', $(element))
          expect(mediaControl.el.innerHTML).toMatchSnapshot()
          expect(
            mediaControl.$el.find('.media-control-left-panel .my-dvr-controls')
              .length,
          ).toEqual(1)
        })
      })
      describe('when disabled', () => {
        it('should disable DVR controls', () => {
          const element = document.createElement('div')
          element.className = 'my-dvr-controls'
          element.textContent = 'live'
          mediaControl.putElement('dvr', $(element))
          expect(mediaControl.el.innerHTML).toMatchSnapshot()
          expect(
            mediaControl.$el.find('.media-control-left-panel .my-dvr-controls')
              .length,
          ).toEqual(0)
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
        core.activeContainer.emit(
          Events.CONTAINER_PLAYBACKDVRSTATECHANGED,
          true,
        )
      })
      it('should apply DVR style class', () => {
        expect(mediaControl.$el.hasClass('dvr')).toBe(true)
      })
    })
  })
})

function arraySubtract<T extends string>(arr1: T[], arr2: T[]) {
  // const ret = arr1.filter((item) => !arr2.includes(item))
  return arr1.filter((item) => !arr2.includes(item))
  // console.log('arraySubtract %s - %s: %s', arr1, arr2, ret)
  // return ret
}
