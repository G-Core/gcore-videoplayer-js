import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Events } from '@clappr/core'

import { AudioTracks } from '../AudioSelector'

import { createMockCore, createMockMediaControl } from '../../../testUtils'
// import { LogTracer, Logger, setTracer } from '@gcorevideo/utils'

// Logger.enable('*')
// setTracer(new LogTracer('AudioSelector.test'))

const TRACKS = [
  { id: '1', label: 'English', language: 'en', track: {} },
  { id: '2', label: 'Spanish', language: 'es', track: {} },
]

describe('AudioSelector', () => {
  let core: any
  let mediaControl: any
  let audioSelector: AudioTracks
  beforeEach(() => {
    core = createMockCore()
    mediaControl = createMockMediaControl(core)
    core.getPlugin = vi.fn().mockImplementation((name: string) => {
      if (name === 'media_control') return mediaControl
      return null
    })
    audioSelector = new AudioTracks(core)
    core.emit(Events.CORE_READY)
    core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
  })
  describe('before media control is rendererd', () => {
    beforeEach(() => {
      emitTracksAvailable(core, TRACKS)
    })
    it('should not attach to the media control', () => {
      expect(mediaControl.mount).not.toHaveBeenCalledWith(
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
      expect(mediaControl.mount).toHaveBeenCalledWith(
        'audiotracks',
        audioSelector.$el,
      )
    })
  })
  describe('given that audio tracks are available', () => {
    beforeEach(() => {
      emitTracksAvailable(core, TRACKS)
    })
    it('should render button', () => {
      expect(audioSelector.$el.find('#audiotracks-button').length).toBe(1)
    })
    it('should render menu hidden', () => {
      expect(audioSelector.el.innerHTML).toMatchSnapshot()
      expect(
        audioSelector.$el.find('#audiotracks-select').hasClass('hidden'),
      ).toBe(true)
      const trackItems = audioSelector.$el.find('#audiotracks-select li')
      expect(trackItems.length).toBe(2)
      expect(trackItems.eq(0).text().trim()).toBe('English')
      expect(trackItems.eq(1).text().trim()).toBe('Spanish')
    })
    describe('when button is clicked', () => {
      beforeEach(() => {
        audioSelector.$el.find('#audiotracks-button').click()
      })
      it('should show menu', () => {
        expect(audioSelector.$el.html()).toMatchSnapshot()
        expect(
          audioSelector.$el.find('#audiotracks-select').hasClass('hidden'),
        ).toBe(false)
      })
      describe('when audio track is selected', () => {
        beforeEach(() => {
          audioSelector.$el
            .find('#audiotracks-select [data-audiotracks-select="2"]')
            .click()
        })
        it('should switch to the selected audio track', () => {
          expect(core.activeContainer.switchAudioTrack).toHaveBeenCalledWith(
            '2',
          )
        })
        it('should hide the menu', () => {
          expect(audioSelector.$el.html()).toMatchSnapshot()
          expect(
            audioSelector.$el.find('#audiotracks-select').hasClass('hidden'),
          ).toBe(true)
        })
        it('should add changing class to the button', () => {
          expect(
            audioSelector.$el.find('#audiotracks-button').hasClass('changing'),
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
              audioSelector.$el
                .find('#audiotracks-button')
                .hasClass('changing'),
            ).toBe(false)
          })
          it('should update button label', () => {
            expect(
              audioSelector.$el
                .find('#audiotracks-button')
                .text()
                .replace(/\/assets.*\.svg/g, '')
                .trim(),
            ).toBe('Spanish')
          })
          it('should highlight the selected menu item', () => {
            const selectedItem = audioSelector.$el.find(
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
              audioSelector.$el.find('#audiotracks-select li.current').length,
            ).toBe(1)
            expect(
              audioSelector.$el.find(
                '#audiotracks-select a.gcore-skin-active[data-audiotracks-select]',
              ).length,
            ).toBe(1)
          })
        })
      })
    })
  })
  describe('when audio tracks are not available', () => {
    it('should not render the button', () => {
      expect(audioSelector.$el.find('#audiotracks-button').length).toBe(0)
      expect(audioSelector.$el.find('#audiotracks-select').length).toBe(0)
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
