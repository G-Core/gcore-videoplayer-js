import { Poster } from '../Poster'
import { describe, it, expect, beforeEach } from 'vitest'
import { createMockCore } from '../../../testUtils'
import { Events, PlayerError } from '@clappr/core'

describe('Poster', () => {
  let core: any
  let poster: Poster
  describe('basically', () => {
    beforeEach(() => {
      core = createMockCore({
        poster: {
          url: 'https://via.placeholder.com/150.png',
        },
      })
      poster = new Poster(core.activeContainer)
      core.activeContainer.trigger(Events.CONTAINER_READY)
    })
    it('should render', () => {
      expect(poster.el.innerHTML).toMatchSnapshot()
    })
    describe('when clicked', () => {
      beforeEach(() => {
        poster.el.click()
      })
      it('should start playback', () => {
        expect(core.activeContainer.play).toHaveBeenCalled()
        expect(core.activeContainer.playback.consent).not.toHaveBeenCalled()
      })
      it('should hide button', () => {
        expect(poster.$el.find('#poster-play')[0].style.display).toBe('none')
      })
      it('should remove clickable class', () => {
        expect(poster.el.classList.contains('clickable')).toBe(false)
      })
    })
    describe('when playback is triggered', () => {
      beforeEach(() => {
        core.activeContainer.playback.trigger(Events.PLAYBACK_PLAY_INTENT)
      })
      it('should hide button', () => {
        expect(poster.$el.find('#poster-play')[0].style.display).toBe('none')
      })
    })
    describe('when playback is about to start', () => {
      describe.each([
        [Events.CONTAINER_STATE_BUFFERING],
        [Events.CONTAINER_STATE_BUFFERFULL],
      ])('event %s', (event) => {
        beforeEach(() => {
          core.activeContainer.buffering = true
          core.activeContainer.trigger(event)
        })
        it('should hide button', () => {
          expect(poster.$el.find('#poster-play')[0].style.display).toBe('none')
        })
      })
    })
    describe('when playback is started', () => {
      beforeEach(() => {
        core.activeContainer.trigger(Events.CONTAINER_PLAY)
        core.activeContainer.playback.trigger(Events.PLAYBACK_PLAY)
      })
      it('should hide poster', () => {
        expect(poster.el.style.display).toBe('none')
      })
    })
    describe('when playback is stopped', () => {
      beforeEach(() => {
        core.activeContainer.trigger(Events.CONTAINER_PLAY)
        core.activeContainer.playback.trigger(Events.PLAYBACK_PLAY)
        core.activeContainer.trigger(Events.CONTAINER_STOP)
      })
      it('should show poster', () => {
        expect(poster.el.style.display).not.toBe('none')
      })
      it('should show button', () => {
        expect(poster.$el.find('#poster-play')[0].style.display).not.toBe(
          'none',
        )
      })
      it('should add clickable class', () => {
        expect(poster.el.classList.contains('clickable')).toBe(true)
      })
    })
  })
  describe('when autoplay is configured', () => {
    beforeEach(() => {
      core = createMockCore({
        autoPlay: true,
      })
      poster = new Poster(core.activeContainer)
      core.activeContainer.trigger(Events.CONTAINER_READY)
    })
    it('should hide button initially', () => {
      expect(poster.$el.find('#poster-play')[0].style.display).toBe('none')
    })
  })
  describe('when error occurs', () => {
    beforeEach(() => {
      core = createMockCore({
        autoPlay: true,
      })
      poster = new Poster(core.activeContainer)
      core.activeContainer.trigger(Events.CONTAINER_READY)
      core.activeContainer.playback.trigger(Events.PLAYBACK_PLAY_INTENT)
      core.activeContainer.trigger(Events.CONTAINER_ERROR, {
        level: PlayerError.Levels.FATAL,
      })
    })
    it('should show poster', () => {
      expect(poster.el.style.display).not.toBe('none')
    })
    it('should hide button', () => {
      expect(poster.$el.find('#poster-play')[0].style.display).toBe('none')
    })
  })
})
