import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ClosedCaptions } from '../ClosedCaptions.js'
import { createMockCore, createMockMediaControl } from '../../../testUtils.js'
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
  describe('basically', () => {
    beforeEach(() => {
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
          // core.emit(Events.CORE_RESIZE, { width: 320, height: 260 })
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
        beforeEach(async () => {
          cc.$el.find('#gplayer-cc-button').click()
          await new Promise((resolve) => setTimeout(resolve, 100))
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
          await new Promise((resolve) => setTimeout(resolve, 100))
          // TODO test explicitly that PLAYBACK_SUBTITLE_CHANGED event does not cause track switch
          core.activePlayback.emit(Events.PLAYBACK_SUBTITLE_CHANGED, { id: 2 })
          await new Promise((resolve) => setTimeout(resolve, 100))
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
          expect(core.activePlayback.closedCaptionsTrackId).toEqual(2)
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
  })
})

function emitSubtitleAvailable(core: any) {
  core.activePlayback.closedCaptionsTracks = [
    {
      id: 1,
      name: 'English',
      track: {
        language: 'en',
        kind: 'subtitles',
        label: 'English',
        mode: 'hidden',
        cues: [],
      },
    },
    {
      id: 2,
      name: 'Spanish',
      track: {
        language: 'es',
        kind: 'subtitles',
        label: 'Spanish',
        mode: 'hidden',
        cues: [],
      },
    },
  ]
  core.activePlayback.emit(Events.PLAYBACK_SUBTITLE_AVAILABLE)
  core.activeContainer.emit(Events.CONTAINER_SUBTITLE_AVAILABLE)
}
