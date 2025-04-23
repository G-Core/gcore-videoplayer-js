import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Events } from '@clappr/core'
import { ExtendedEvents } from '../../media-control/MediaControl'
import { AudioTracks } from '../AudioTracks'

import { createMockCore, createMockMediaControl } from '../../../testUtils'
// import { LogTracer, Logger, setTracer } from '@gcorevideo/utils'

// Logger.enable('*')
// setTracer(new LogTracer('AudioTracks.test'))

const TRACKS = [
  { id: '1', label: 'English', language: 'en', track: {} },
  { id: '2', label: 'Spanish', language: 'es', track: {} },
]

describe('AudioTracks', () => {
  let core: any
  let mediaControl: any
  let audioTracks: AudioTracks
  beforeEach(() => {
    core = createMockCore()
    mediaControl = createMockMediaControl(core)
    core.getPlugin = vi.fn().mockImplementation((name: string) => {
      if (name === 'media_control') return mediaControl
      return null
    })
    audioTracks = new AudioTracks(core)
    core.emit(Events.CORE_READY)
    core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
  })
  describe('before media control is rendererd', () => {
    beforeEach(() => {
      emitTracksAvailable(core, TRACKS)
    })
    it('should not attach to the media control', () => {
      expect(mediaControl.slot).not.toHaveBeenCalledWith(
        'audiotracks',
        expect.anything(),
      )
    })
  })
  describe('when media control is rendered', () => {
    beforeEach(() => {
      mediaControl.trigger(Events.MEDIACONTROL_RENDERED)
    })
    it('should attach to the media control', () => {
      expect(mediaControl.slot).toHaveBeenCalledWith(
        'audiotracks',
        audioTracks.$el,
      )
    })
  })
  describe('given that audio tracks are available', () => {
    beforeEach(() => {
      emitTracksAvailable(core, TRACKS)
    })
    it('should render button', () => {
      expect(audioTracks.$el.find('#audiotracks-button').length).toBe(1)
    })
    it('should render menu hidden', () => {
      expect(audioTracks.el.innerHTML).toMatchSnapshot()
      expect(
        audioTracks.$el.find('#audiotracks-select').hasClass('hidden'),
      ).toBe(true)
      const trackItems = audioTracks.$el.find('#audiotracks-select li')
      expect(trackItems.length).toBe(2)
      expect(trackItems.eq(0).text().trim()).toBe('English')
      expect(trackItems.eq(1).text().trim()).toBe('Spanish')
    })
    describe('when button is clicked', () => {
      beforeEach(() => {
        audioTracks.$el.find('#audiotracks-button').click()
      })
      it('should show menu', () => {
        expect(audioTracks.$el.html()).toMatchSnapshot()
        expect(
          audioTracks.$el.find('#audiotracks-select').hasClass('hidden'),
        ).toBe(false)
      })
      it('should collapse all other menus', () => {
        expect(mediaControl.trigger).toHaveBeenCalledWith(
          ExtendedEvents.MEDIACONTROL_MENU_COLLAPSE,
          'audio_tracks',
        )
      })
      describe('when audio track is selected', () => {
        beforeEach(() => {
          audioTracks.$el
            .find('#audiotracks-select [data-audiotracks-select="2"]')
            .click()
        })
        it('should switch to the selected audio track', () => {
          expect(core.activeContainer.switchAudioTrack).toHaveBeenCalledWith(
            '2',
          )
        })
        it('should hide the menu', () => {
          expect(audioTracks.$el.html()).toMatchSnapshot()
          expect(
            audioTracks.$el.find('#audiotracks-select').hasClass('hidden'),
          ).toBe(true)
          expect(audioTracks.$el.find('#audiotracks-button').attr('aria-expanded')).toBe('false')
        })
        it('should add changing class to the button', () => {
          expect(
            audioTracks.$el.find('#audiotracks-button').hasClass('changing'),
          ).toBe(true)
        })
        describe('when current audio track changes', () => {
          beforeEach(() => {
            core.activePlayback.currentAudioTrack =
              core.activePlayback.audioTracks[1]
            core.activePlayback.emit(
              Events.PLAYBACK_AUDIO_CHANGED,
              core.activePlayback.currentAudioTrack,
            )
            core.activeContainer.emit(
              Events.CONTAINER_AUDIO_CHANGED,
              core.activePlayback.currentAudioTrack,
            )
          })
          it('should update button class', () => {
            expect(
              audioTracks.$el
                .find('#audiotracks-button')
                .hasClass('changing'),
            ).toBe(false)
          })
          it('should update button label', () => {
            expect(
              audioTracks.$el
                .find('#audiotracks-button')
                .text()
                .replace(/\/assets.*\.svg/g, '')
                .trim(),
            ).toBe('Spanish')
          })
          it('should highlight the selected menu item', () => {
            const selectedItem = audioTracks.$el.find(
              '#audiotracks-select .current',
            )
            expect(selectedItem.text().trim()).toBe('Spanish')
            expect(
              selectedItem
                .find('a[data-audiotracks-select]')
                .hasClass('gcore-skin-active'),
            ).toBe(true)
          })
          it('should unhighlight any previously highlighted menu item', () => {
            expect(
              audioTracks.$el.find('#audiotracks-select li.current').length,
            ).toBe(1)
            expect(
              audioTracks.$el.find(
                '#audiotracks-select a.gcore-skin-active[data-audiotracks-select]',
              ).length,
            ).toBe(1)
          })
        })
      })
    })
    describe('when button is clicked twice', () => {
      beforeEach(() => {
        audioTracks.$el.find('#audiotracks-button').click()
        audioTracks.$el.find('#audiotracks-button').click()
      })
      it('should collapse the menu', () => {
        expect(audioTracks.$el.find('#audiotracks-select').hasClass('hidden')).toBe(true)
        expect(audioTracks.$el.find('#audiotracks-button').attr('aria-expanded')).toBe('false')
      })
    })
  })
  describe('when audio tracks are not available', () => {
    it('should not render the button', () => {
      expect(audioTracks.$el.find('#audiotracks-button').length).toBe(0)
      expect(audioTracks.$el.find('#audiotracks-select').length).toBe(0)
    })
  })
})

function emitTracksAvailable(core: any, tracks: any[]) {
  core.activePlayback.audioTracks = tracks
  core.activePlayback.currentAudioTrack = tracks[0]
  core.activePlayback.emit(
    Events.PLAYBACK_AUDIO_AVAILABLE,
    core.activePlayback.audioTracks,
  )
  core.activeContainer.emit(
    Events.CONTAINER_AUDIO_AVAILABLE,
    core.activePlayback.audioTracks,
  )
}
