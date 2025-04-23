import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest'
import {
  MediaControl,
  MediaControlElement,
  MediaControlSettings,
  MediaControlSlotSelector,
} from '../MediaControl'
import { createMockCore } from '../../../testUtils'
import { $, Events, Playback } from '@clappr/core'

vi.mock('../../utils/fullscreen', () => ({
  fullscreenEnabled: vi.fn().mockReturnValue(true),
  isFullscreen: vi.fn().mockReturnValue(false),
}))

// import { LogTracer, Logger, setTracer } from '@gcorevideo/utils'

// Logger.enable('*')
// setTracer(new LogTracer('MediaControl.test'))

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
  describe('rendering timing', () => {
    beforeEach(() => {
      mediaControl = new MediaControl(core)
      core.emit(Events.CORE_READY)
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
      core.activeContainer.settings = {
        left: ['playpause', 'position', 'duration', 'volume'],
        default: ['seekbar'],
        right: ['fullscreen', 'hd-indicator'],
        seekEnabled: true,
      } as MediaControlSettings
      core.activePlayback.emit(Events.PLAYBACK_SETTINGSUPDATE)
      core.activeContainer.emit(Events.CONTAINER_SETTINGSUPDATE)
    })
    describe('until metadata is loaded', () => {
      it('should not render', () => {
        expect(mediaControl.el.innerHTML).toBe('')
      })
    })
    describe('once metadata is loaded', () => {
      beforeEach(() => {
        core.activePlayback.emit(Events.PLAYBACK_LOADEDMETADATA)
        core.activeContainer.emit(Events.CONTAINER_LOADEDMETADATA)
      })
      // TODO review why delay is needed
      it('should wait a delay before rendering anything', async () => {
        expect(mediaControl.el.innerHTML).toBe('')
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(mediaControl.el.innerHTML).toMatchSnapshot()
        expect(
          mediaControl.$el.find('.media-control-left-panel [data-playpause]')
            .length,
        ).toBeGreaterThan(0)
        expect(
          mediaControl.$el.find('.media-control-left-panel [data-volume]')
            .length,
        ).toBeGreaterThan(0)
        expect(
          mediaControl.$el.find('.media-control-center-panel [data-seekbar]')
            .length,
        ).toBeGreaterThan(0)
        expect(
          mediaControl.$el.find('.media-control-right-panel [data-fullscreen]')
            .length,
        ).toBeGreaterThan(0)
      })
      it('should hide volume bar', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        const volumeBar = mediaControl.$el.find(
          '.media-control-left-panel .bar-container[data-volume]',
        )
        expect(volumeBar[0].classList.contains('volume-bar-hide')).toBe(true)
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
      beforeEach(async () => {
        core.activeContainer.getPlaybackType.mockReturnValue(Playback.LIVE)
        core.activePlayback.getPlaybackType.mockReturnValue(Playback.LIVE)
        core.getPlaybackType.mockReturnValue(Playback.LIVE)
        // This is not strictly necessary as the CSS class is applied on the root element and does not require rendering.
        // However, it makes the scenario more realistic
        await runMetadataLoaded(core)
        // TODO playback.settings
        core.activePlayback.emit(Events.PLAYBACK_SETTINGSUPDATE)
      })
      it('should apply live style class', () => {
        expect(mediaControl.$el.hasClass('live')).toBe(true)
      })
    })
    describe('when vod', () => {
      beforeEach(async () => {
        core.activeContainer.getPlaybackType.mockReturnValue(Playback.VOD)
        core.activePlayback.getPlaybackType.mockReturnValue(Playback.VOD)
        core.getPlaybackType.mockReturnValue(Playback.VOD)
        await runMetadataLoaded(core)
      })
      it('should not apply live style class', () => {
        expect(mediaControl.$el.hasClass('live')).toBe(false)
      })
    })
  })
  // TODO drop, deprecated
  describe('slot', () => {
    beforeEach(async () => {
      mediaControl = new MediaControl(core)
      core.emit(Events.CORE_READY)
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
      core.activeContainer.settings = {}
      core.emit(Events.CONTAINER_SETTINGSUPDATE)
      await runMetadataLoaded(core)
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
        mediaControl.slot(mcName, $(element))

        expect(mediaControl.el.innerHTML).toMatchSnapshot()
        expect(
          mediaControl.$el.find('.media-control-right-panel .my-media-control')
            .length,
        ).toEqual(1)
      })
    })
  })
  describe('mount', () => {
    beforeEach(async () => {
      mediaControl = new MediaControl(core)
      core.emit(Events.CORE_READY)
      core.activeContainer.settings = {
        left: ['playpause', 'position', 'duration', 'volume'],
        default: ['_'],
        right: ['fullscreen', 'hd-indicator'],
        seekEnabled: true,
      } as MediaControlSettings
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
      core.emit(Events.CONTAINER_SETTINGSUPDATE)
      await runMetadataLoaded(core)
    })
    describe.each([
      ['root', '> #test-element'],
      ['base', '.media-control-layer > #test-element'],
      ['left', '.media-control-left-panel > #test-element'],
      ['right', '.media-control-right-panel > #test-element'],
      ['center', '.media-control-center-panel > #test-element'],
    ])('%s', (name: string, checkSelector: string) => {
      it('should attach node to DOM tree', () => {
        mediaControl.mount(
          name as MediaControlSlotSelector,
          $('<div id="test-element">test</div>'),
        )
        expect(mediaControl.el.innerHTML).toMatchSnapshot()
        expect(mediaControl.$el.find(checkSelector).length).toBe(1)
      })
    })
  })
  describe('container/playback settings', () => {
    beforeEach(async () => {
      mediaControl = new MediaControl(core)
      core.emit(Events.CORE_READY)
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
      await runMetadataLoaded(core)
    })
    describe.each([
      [
        // TODO nothing has changed
        'vod',
        {
          left: ['playpause', 'position', 'duration', 'volume'],
          default: ['seekbar'],
          right: ['fullscreen', 'hd-indicator'],
          seekEnabled: true,
        } as MediaControlSettings,
        // live
        // live + dvr
      ],
    ])('%s', (_, settings: MediaControlSettings) => {
      beforeEach(() => {
        core.activeContainer.settings = settings
        core.activePlayback.emit(Events.PLAYBACK_SETTINGSUPDATE)
        core.activeContainer.emit(Events.CONTAINER_SETTINGSUPDATE)
      })
      it.each(settings.left)('should render %s control', (element) => {
        const el = mediaControl.$el.find(
          `.media-control-left-panel [data-${element}]`,
        )
        expect(el.length).toBeGreaterThan(0)
      })
      it.each(
        arraySubtract(
          ['playpause', 'playstop', 'position', 'duration', 'volume'],
          settings.left,
        ),
      )('should not render %s control', (element) => {
        const el = mediaControl.$el.find(
          `.media-control-left-panel [data-${element}]`,
        )
        expect(el.length).toEqual(0)
      })
      it(`should ${
        settings.seekEnabled ? '' : 'not '
      }render the seek bar`, () => {
        const seekbar = mediaControl.$el.find(
          '.media-control-center-panel [data-seekbar]',
        )
        expect(seekbar.length).toBeGreaterThan(1)
        if (settings.seekEnabled) {
          expect(seekbar.hasClass('seek-disabled')).toBe(false)
        } else {
          expect(seekbar.hasClass('seek-disabled')).toBe(true)
        }
      })
      it(`should ${
        settings.left.includes('volume') ? '' : 'not '
      }render the volume control`, () => {
        const volume = mediaControl.$el.find('.drawer-container[data-volume]')
        if (settings.left.includes('volume')) {
          expect(volume.length).toEqual(1)
        } else {
          expect(volume.length).toEqual(0)
        }
      })
      it(`should ${
        settings.right.includes('fullscreen') ? '' : 'not '
      }render the fullscreen control`, () => {
        const fullscreen = mediaControl.$el.find(
          '.media-control-right-panel [data-fullscreen]',
        )
        if (settings.right.includes('fullscreen')) {
          expect(fullscreen.length).toEqual(1)
        } else {
          expect(fullscreen.length).toEqual(0)
        }
      })
    })
    describe('basically', () => {
      let handler: MockedFunction<() => void>
      beforeEach(() => {
        handler = vi.fn()
        mediaControl.on(Events.MEDIACONTROL_RENDERED, handler, null)
      })
      describe('when settings change', () => {
        beforeEach(() => {
          core.activeContainer.settings = {
            left: ['playpause', 'position', 'duration'],
            seekEnabled: true,
            right: ['fullscreen', 'hd-indicator'],
          }
          handler = vi.fn()
          mediaControl.on(Events.MEDIACONTROL_RENDERED, handler, null)
          core.activeContainer.emit(Events.CONTAINER_SETTINGSUPDATE)
        })
        it('should trigger MEDIACONTROL_RENDERED event', () => {
          expect(handler).toHaveBeenCalled()
        })
      })
    })
  })
  describe('dvr mode', () => {
    beforeEach(async () => {
      mediaControl = new MediaControl(core)
      core.emit(Events.CORE_READY)
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
      await runMetadataLoaded(core)
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
  describe('seekbar', () => {
    beforeEach(async () => {
      mediaControl = new MediaControl(core)
      core.emit(Events.CORE_READY)
      core.activeContainer.settings = {
        seekEnabled: true,
        default: ['seekbar'],
      }
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
      await runMetadataLoaded(core)
      core.activeContainer.emit(Events.CONTAINER_SETTINGSUPDATE)
    })
    it('should render', () => {
      expect(mediaControl.el.innerHTML).toMatchSnapshot()
    })
  })
})

function arraySubtract<T extends string>(arr1: T[], arr2: T[]) {
  return arr1.filter((item) => !arr2.includes(item))
}

function runMetadataLoaded(core: any) {
  core.activePlayback.emit(Events.PLAYBACK_LOADEDMETADATA)
  core.activeContainer.emit(Events.CONTAINER_LOADEDMETADATA)
  return new Promise((resolve) => setTimeout(resolve, 25))
}
