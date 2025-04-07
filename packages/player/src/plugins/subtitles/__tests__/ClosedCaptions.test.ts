import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ClosedCaptions } from '../ClosedCaptions.js'
import { createMockCore, createMockMediaControl } from '../../../testUtils.js'
import { ExtendedEvents } from '../../media-control/MediaControl.js'

import { LogTracer, Logger, setTracer } from '@gcorevideo/utils'
import { Events } from '@clappr/core'
// import { Events } from '@clappr/core';

// Logger.enable('*')
// setTracer(new LogTracer('ClosedCaptions.test'))

describe('ClosedCaptions', () => {
  let core: any
  let mediaControl: any
  let cc: ClosedCaptions
  beforeEach(() => {
    core = createMockCore()
    mediaControl = createMockMediaControl(core)
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
    })
    it('should render', () => {
      expect(cc.el.innerHTML).toMatchSnapshot()
      expect(cc.$el.find('#cc-button').length).toEqual(1)
      expect(mediaControl.mount).toHaveBeenCalledWith('cc', cc.$el)
    })
    describe('when button is clicked', () => {
      beforeEach(() => {
        cc.$el.find('#cc-button').click()
      })
      it('should open menu', () => {
        expect(cc.$el.find('#cc-select').css('display')).not.toBe('none')
      })
      it('should collapse all other menus', () => {
        expect(mediaControl.trigger).toHaveBeenCalledWith(
          ExtendedEvents.MEDIACONTROL_MENU_COLLAPSE,
          'cc',
        )
      })
    })
    describe('when clicked twice', () => {
      beforeEach(() => {
        cc.$el.find('#cc-button').click().click()
      })
      it('should collapse the menu', () => {
        expect(cc.$el.find('#cc-select').css('display')).toBe('none')
      })
    })
    describe('when media control is hidden', () => {
      beforeEach(() => {
        cc.$el.find('#cc-button').click()
        mediaControl.trigger(Events.MEDIACONTROL_HIDE)
      })
      it('should hide menu', () => {
        expect(cc.$el.find('#cc-select').css('display')).toBe('none')
      })
    })
  })
})
