import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'

import { ClosedCaptions } from '../ClosedCaptions.js'
import { createMockContainer, createMockCore, createMockMediaControl } from '../../../testUtils.js'
import { ExtendedEvents } from '../../media-control/MediaControl.js'

import { Events } from '@clappr/core'

// import { LogTracer, Logger, setTracer } from '@gcorevideo/utils'

// Logger.enable('*')
// setTracer(new LogTracer('ClosedCaptions.test'))

describe('ClosedCaptions', () => {
  let core: any
  let mediaControl: any
  let cc: ClosedCaptions
  beforeEach(() => {
    vi.useFakeTimers()
    core = createMockCore()
    mediaControl = createMockMediaControl(core)
    mediaControl.getAvailablePopupHeight = vi.fn().mockReturnValue(211)
    core.getPlugin = vi.fn().mockImplementation((name) => {
      if (name === 'media_control') {
        return mediaControl
      }
      return null
    })
    cc = new ClosedCaptions(core)
  })
  afterEach(() => {
    vi.useRealTimers()
  })
  describe('basically', () => {
    beforeEach(() => {
      core.options.cc = { language: 'none' }
      core.emit(Events.CORE_READY)
      core.activePlayback.el = document.createElement('video')
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
    })
    describe('until subtitle tracks are available', () => {
      it('should not mount', () => {
        expect(mediaControl.slot).not.toHaveBeenCalledWith(
          'cc',
          expect.anything(),
        )
      })
      it("should not render", () => {
        expect(cc.el.innerHTML).toBe('')
      })
      it('should not mount', () => {
        expect(mediaControl.slot).not.toHaveBeenCalledWith(
          'cc',
          expect.anything(),
        )
      })
    })
    describe("when subtitle tracks are available", () => {
      beforeEach(() => {
        emitSubtitleAvailable(core)
        vi.advanceTimersByTime(1)
      })
      it('should render', () => {
        expect(cc.el.innerHTML).toMatchSnapshot()
      })
      describe('when viewport is resized', () => {
        beforeEach(() => {
          mediaControl.getAvailablePopupHeight = vi.fn().mockReturnValue(197)
          core.activeContainer.emit(Events.CONTAINER_RESIZE, {
            width: 320,
            height: 260,
          })
        })
        it('should clamp popup height', () => {
          expect(cc.$el.find('#gplayer-cc-menu').css('max-height')).toBe('197px')
        })
      })
      describe('when media control is rerendered', () => {
        beforeEach(() => {
          mediaControl.trigger(Events.MEDIACONTROL_RENDERED)
        })
        it('should mount', () => {
          expect(mediaControl.slot).toHaveBeenCalledWith('cc', cc.$el)
        })
      })
      describe('when button is clicked', () => {
        beforeEach(() => {
          cc.$el.find('#gplayer-cc-button').click()
        })
        it('should open menu', () => {
          expect(cc.$el.find('#gplayer-cc-menu').css('display')).not.toBe('none')
          expect(cc.$el.find('#gplayer-cc-button').attr('aria-expanded')).toBe(
            'true',
          )
        })
        it('should collapse all other menus', () => {
          expect(mediaControl.trigger).toHaveBeenCalledWith(
            ExtendedEvents.MEDIACONTROL_MENU_COLLAPSE,
            'cc',
          )
        })
        it('should clamp popup height', () => {
          expect(cc.$el.find('#gplayer-cc-menu').css('max-height')).toBe('211px')
        })
      })
      describe('when clicked twice', () => {
        beforeEach(() => {
          cc.$el.find('#gplayer-cc-button').click().click()
        })
        it('should collapse the menu', () => {
          expect(cc.$el.find('#gplayer-cc-menu').css('display')).toBe('none')
          expect(cc.$el.find('#gplayer-cc-button').attr('aria-expanded')).toBe(
            'false',
          )
        })
      })
      describe('when media control is hidden', () => {
        beforeEach(() => {
          cc.$el.find('#cc-button').click()
          mediaControl.trigger(Events.MEDIACONTROL_HIDE)
        })
        it('should hide menu', () => {
          expect(cc.$el.find('#gplayer-cc-menu').css('display')).toBe('none')
        })
      })
      describe('when container is clicked', () => {
        beforeEach(() => {
          cc.$el.find('#gplayer-cc-button').click()
          core.activeContainer.emit(Events.CONTAINER_CLICK)
        })
        it('should hide menu', () => {
          expect(cc.$el.find('#gplayer-cc-menu').css('display')).toBe('none')
          expect(cc.$el.find('#gplayer-cc-button').attr('aria-expanded')).toBe(
            'false',
          )
        })
      })
      describe('when subtitle is changed', () => {
        beforeEach(() => {
          cc.$el.find('#gplayer-cc-button').click()
          vi.advanceTimersByTime(100)
          core.activePlayback.getCurrentTime = vi.fn().mockReturnValue(7)
          core.activeContainer.getCurrentTime = vi.fn().mockReturnValue(7)
          core.activePlayback.closedCaptionsTracks[1].track.cues = [
            {
              startTime: 0,
              endTime: 5,
              text: 'Alright this is me',
              getCueAsHTML: vi
                .fn()
                .mockImplementation(() =>
                  document.createTextNode('Alright this is me'),
                ),
            },
            {
              startTime: 5,
              endTime: 10,
              text: 'Welcome to my channel',
              getCueAsHTML: vi
                .fn()
                .mockImplementation(() =>
                  document.createTextNode('Welcome to my channel'),
                ),
            },
            {
              startTime: 10,
              endTime: 15,
              text: 'Thank you for watching',
              getCueAsHTML: vi
                .fn()
                .mockImplementation(() =>
                  document.createTextNode('Thank you for watching'),
                ),
            },
          ]
          cc.$el.find('#gplayer-cc-menu li:nth-child(2) a').click()
          vi.advanceTimersByTime(100)
          // TODO test explicitly that PLAYBACK_SUBTITLE_CHANGED event does not cause track switch
          core.activePlayback.emit(Events.PLAYBACK_SUBTITLE_CHANGED, { id: 2 })
          vi.advanceTimersByTime(100)
        })
        it('should activate selected track', () => {
          expect(core.activePlayback.closedCaptionsTracks[1].track.mode).toBe(
            'hidden',
          )
          expect(core.activePlayback.closedCaptionsTracks[0].track.mode).toBe(
            'disabled',
          )
        })
        it('should show active subtitle text', () => {
          expect(
            core.activeContainer.$el.find('#gplayer-cc-line').text().trim(),
          ).toEqual('Welcome to my channel')
        })
      })
      describe('when subtitle is selected from menu', () => {
        beforeEach(() => {
          cc.$el.find('#gplayer-cc-menu li:nth-child(2) a').click()
        })
        it('should activate native subtitles track', () => {
          expect(core.activePlayback.setTextTrack).toHaveBeenCalledWith(1)
          expect(core.activePlayback.closedCaptionsTrackId).toEqual(1)
        })
        it('should highlight selected menu item', () => {
          expect(
            cc.$el.find('#gplayer-cc-menu li:nth-child(2)').hasClass('current'),
          ).toBe(true)
          expect(
            cc.$el
              .find('#gplayer-cc-menu li:nth-child(2) a')
              .attr('aria-checked'),
          ).toBe('true')
          expect(cc.$el.find('#gplayer-cc-menu li.current').length).toBe(1)
          expect(
            cc.$el.find('#gplayer-cc-menu li a[aria-checked="true"]').length,
          ).toBe(1)
        })
        it('should collapse menu', () => {
          expect(cc.$el.find('#gplayer-cc-menu').css('display')).toBe('none')
        })
      })
      describe('when user turns off subtitles', () => {
        beforeEach(() => {
          core.activePlayback.closedCaptionsTracks[1].track.mode = 'showing'
          core.activePlayback.closedCaptionsTrackId = 2
          core.activePlayback.emit(Events.PLAYBACK_SUBTITLE_CHANGED, { id: 2 })
          cc.$el.find('#gplayer-cc-button').click()
          cc.$el.find('#gplayer-cc-menu li:nth-child(3) a').click() // off
        })
        it('should hide menu', () => {
          expect(cc.$el.find('#gplayer-cc-menu').css('display')).toBe('none')
        })
        it('should hide subtitle text', () => {
          expect(
            core.activeContainer.$el.find('#gplayer-cc-line').text().trim(),
          ).toBe('')
        })
        it('should deactivate subtitle track', () => {
          expect(core.activePlayback.closedCaptionsTrackId).toEqual(-1)
          expect(core.activePlayback.closedCaptionsTracks[0].track.mode).toBe(
            'disabled',
          )
          expect(core.activePlayback.closedCaptionsTracks[1].track.mode).toBe(
            'disabled',
          )
        })
        it('should select menu item', () => {
          expect(
            cc.$el.find('#gplayer-cc-menu li:nth-child(3)').hasClass('current'),
          ).toBe(true)
          expect(
            cc.$el
              .find('#gplayer-cc-menu li:nth-child(3) a')
              .attr('aria-checked'),
          ).toBe('true')
          expect(cc.$el.find('#gplayer-cc-menu li.current').length).toBe(1)
          expect(
            cc.$el.find('#gplayer-cc-menu li a[aria-checked="true"]').length,
          ).toBe(1)
        })
      })
    })
    describe('when language is configured', () => {
      describe("and is set to 'none'", () => {
        beforeEach(() => {
          core.options.cc = { language: 'none' }
          emitSubtitleAvailable(core)
          vi.advanceTimersByTime(1)
        })
        it('should disable subtitles', () => {
          expect(core.activePlayback.closedCaptionsTrackId).toEqual(-1)
          expect(
            core.activeContainer.$el.find('#gplayer-cc-line').text().trim(),
          ).toBe('')
        })
        it('should have all tracks disabled', () => {
          expect(core.activePlayback.closedCaptionsTracks[0].track.mode).toBe(
            'disabled',
          )
          expect(core.activePlayback.closedCaptionsTracks[1].track.mode).toBe(
            'disabled',
          )
        })
        it('should hide subtitles', () => {
          expect(cc.$el.find('#gplayer-cc-menu').css('display')).toBe('none')
        })
      })
      describe('when language is undefined', () => {
        beforeEach(() => {
          core.options.cc = {}
          core.activePlayback.closedCaptionsTrackId = undefined
          emitSubtitleAvailable(core, 1)
          vi.advanceTimersByTime(1)
        })
        // The native engine will decide
        it('should not automatically select any track', () => {
          expect(core.activePlayback.closedCaptionsTrackId).toEqual(undefined)
          expect(core.activePlayback.setTextTrack).not.toHaveBeenCalled()
        })
        it('should not touch any tracks', () => {
          expect(core.activePlayback.el.textTracks[0].mode).toBe('hidden')
          // Track #1 is set active (as if selected by the engine), @see {emitSubtitleAvailable}()
          expect(core.activePlayback.el.textTracks[1].mode).toBe('showing')
        })
      })
      describe('when language matches a track', () => {
        beforeEach(() => {
          core.options.cc = { language: 'en' }
          emitSubtitleAvailable(core)
          vi.advanceTimersByTime(1)
        })
        it('should activate the matching track', () => {
          expect(core.activePlayback.closedCaptionsTrackId).toEqual(0)
          expect(core.activePlayback.setTextTrack).toHaveBeenCalledWith(0)
        })
        // TODO with options.cc.mode='native' the selected track's mode should be 'showing'
        it('should set the matching track mode appropriately', () => {
          expect(core.activePlayback.el.textTracks[0].mode).toBe('hidden')
          expect(core.activePlayback.el.textTracks[1].mode).toBe('disabled')
        })
        it('should highlight the matching track in menu', () => {
          expect(
            cc.$el.find('#gplayer-cc-menu li:nth-child(1)').hasClass('current'),
          ).toBe(true)
        })
      })
      describe('when language does not match any track', () => {
        beforeEach(() => {
          core.options.cc = { language: 'fr' }
          core.emit(Events.CORE_READY)
          core.activePlayback.el = document.createElement('video')
          core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
          emitSubtitleAvailable(core)
          vi.advanceTimersByTime(1)
        })
        it('should disable subtitles', () => {
          expect(core.activePlayback.closedCaptionsTrackId).toEqual(-1)
        })
        it('should have all tracks disabled', () => {
          expect(core.activePlayback.closedCaptionsTracks[0].track.mode).toBe(
            'disabled',
          )
          expect(core.activePlayback.closedCaptionsTracks[1].track.mode).toBe(
            'disabled',
          )
        })
        it('should hide subtitle text', () => {
          expect(
            core.activeContainer.$el.find('#gplayer-cc-line').text().trim(),
          ).toBe('')
        })
      })
    })
    describe('when subtitle available event occurs after user selection', () => {
      describe('if user selected track before event', () => {
        beforeEach(() => {
          core.options.cc = { language: 'en' }
          // First subtitle available event
          emitSubtitleAvailable(core)
          vi.advanceTimersByTime(1)
          cc.$el.find('#gplayer-cc-button').click()
          vi.advanceTimersByTime(1)
          // User manually selects Spanish track
          cc.$el.find('#gplayer-cc-menu li:nth-child(2) a').click()
          vi.advanceTimersByTime(1)

          core.activeContainer = createMockContainer()
          // Reset isPreselectedApplied by emitting container changed
          core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
          // Second subtitle available event (e.g., after source switch)
          emitSubtitleAvailable(core)
          vi.advanceTimersByTime(1)
        })
        it('should run preselected language matching algorithm', () => {
          // Should activate track selected by user
          expect(core.activePlayback.setTextTrack).toHaveBeenCalledWith(1)
          expect(core.activePlayback.closedCaptionsTrackId).toEqual(1)
        })
        it('should select track based on configured language', () => {
          expect(
            cc.$el.find('#gplayer-cc-menu li:nth-child(2)').hasClass('current'),
          ).toBe(true)
        })
        it('should activate the track matching the selected', () => {
          expect(core.activePlayback.closedCaptionsTracks[0].track.mode).toBe(
            'disabled',
          )
          // not 'showing' because the plugin manages the subtitles rendition
          expect(core.activePlayback.closedCaptionsTracks[1].track.mode).toBe(
            'hidden',
          )
        })
      })
      describe('when multiple subtitle available events occur', () => {
        beforeEach(() => {
          core.options.cc = { language: 'en' }
          // First subtitle available event
          emitSubtitleAvailable(core)
          vi.advanceTimersByTime(1)
          core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
          vi.advanceTimersByTime(1)
          core.activePlayback.closedCaptionsTrackId = undefined
          // Second subtitle available event
          emitSubtitleAvailable(core)
          vi.advanceTimersByTime(1)
        })
        it('should reapply preselected language matching and activate the matching track', () => {
          expect(core.activePlayback.setTextTrack).toHaveBeenCalledWith(0)
          expect(core.activePlayback.closedCaptionsTrackId).toEqual(0)
          expect(
            cc.$el.find('#gplayer-cc-menu li:nth-child(1)').hasClass('current'),
          ).toBe(true)
        })
        it('should activate the matching track', () => {
          expect(core.activePlayback.el.textTracks[0].mode).toBe(
            'hidden',
          )
          expect(core.activePlayback.el.textTracks[1].mode).toBe(
            'disabled',
          )
        })
      })
    })
    describe.each([['html5_video', false], ['dash', false], ['hls', true]] as const)(
      'when playback engine is %s',
      (playbackEngine, isManaged) => {
        beforeEach(() => {
          core.activePlayback.el = document.createElement('video')
          core.activePlayback.name = playbackEngine
        })
        describe('when language is configured and matches a track', () => {
          beforeEach(() => {
            core.options.cc = { language: 'en' }
            emitSubtitleAvailable(core)
            vi.advanceTimersByTime(1)
          })
          it('should call setTextTrack with matching track id', () => {
            expect(core.activePlayback.setTextTrack).toHaveBeenCalledWith(0)
          })
          it('should set closedCaptionsTrackId to matching track id', () => {
            expect(core.activePlayback.closedCaptionsTrackId).toEqual(0)
          })
          if (isManaged) {
            it('should not touch native tracks', () => {
              expect(core.activePlayback.el.textTracks[0].mode).toBe('hidden')
              expect(core.activePlayback.el.textTracks[1].mode).toBe('hidden')
            })
          } else {
            it('should disable inactive native track', () => {
              expect(core.activePlayback.el.textTracks[1].mode).toBe('disabled')
            })
            it('should keep active native track hidden', () => {
              expect(core.activePlayback.el.textTracks[0].mode).toBe('hidden')
            })
          }
        })
        describe('when language is configured but does not match any track', () => {
          beforeEach(() => {
            core.options.cc = { language: 'fr' }
            core.emit(Events.CORE_READY)
            core.activePlayback.el = document.createElement('video')
            core.activePlayback.name = playbackEngine
            core.activePlayback.setTextTrack = vi.fn()
            core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
            emitSubtitleAvailable(core)
            vi.advanceTimersByTime(1)
          })
          it('should disable subtitles', () => {
            expect(core.activePlayback.setTextTrack).toHaveBeenCalledWith(-1)
            expect(core.activePlayback.closedCaptionsTrackId).toEqual(-1)
          })
        })
        describe('when user selects a track from menu', () => {
          beforeEach(() => {
            core.activePlayback.setTextTrack = vi.fn()
            emitSubtitleAvailable(core)
            vi.advanceTimersByTime(1)
            cc.$el.find('#gplayer-cc-menu li:nth-child(2) a').click()
            vi.advanceTimersByTime(1)
          })
          it('should call setTextTrack with selected track id', () => {
            expect(core.activePlayback.setTextTrack).toHaveBeenCalledWith(1)
          })
          it('should update closedCaptionsTrackId', () => {
            expect(core.activePlayback.closedCaptionsTrackId).toEqual(1)
          })
        })
        describe('when language is set to none', () => {
          beforeEach(() => {
            core.options.cc = { language: 'none' }
            core.emit(Events.CORE_READY)
            core.activePlayback.el = document.createElement('video')
            core.activePlayback.name = playbackEngine
            core.activePlayback.setTextTrack = vi.fn()
            core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
            emitSubtitleAvailable(core)
            vi.advanceTimersByTime(1)
          })
          it('should disable subtitles', () => {
            expect(core.activePlayback.setTextTrack).toHaveBeenCalledWith(-1)
          })
        })
      },
    )
  })
})

function emitSubtitleAvailable(core: any, selectedTrackId?: number) {
  const domTracks = [
    {
      language: 'en',
      kind: 'subtitles',
      label: 'English',
      mode: selectedTrackId === 0 ? 'showing' : 'hidden',
      cues: [],
      id: "01en"
    },
    {
      language: 'es',
      kind: 'subtitles',
      label: 'Español',
      mode: selectedTrackId === 1 ? 'showing' : 'hidden',
      cues: [],
      id: "02es"
    }
  ]
  core.activePlayback.closedCaptionsTracks = domTracks.map((t, index) => ({
    id: index,
    name: t.label,
    track: t,
  }))
  vi.spyOn(core.activePlayback.el, 'textTracks', 'get').mockReturnValue(domTracks)
  core.activePlayback.emit(Events.PLAYBACK_SUBTITLE_AVAILABLE)
  core.activeContainer.emit(Events.CONTAINER_SUBTITLE_AVAILABLE)
}
