import { beforeEach, describe, it, expect } from 'vitest'
import { Events } from '@clappr/core'

import { BigMuteButton } from '../BigMuteButton.js'
import { createMockCore } from '../../../testUtils.js'

// import { Logger, LogTracer, setTracer } from '@gcorevideo/utils'

// setTracer(new LogTracer('BigMuteButton.test'))
// Logger.enable('*')

describe('BigMuteButton', () => {
  let core: any
  let bmb: BigMuteButton
  beforeEach(() => {
    core = createMockCore({})
    bmb = new BigMuteButton(core)
  })
  describe('basically', () => {
    it('should render', () => {
      expect(bmb.$el.html()).toMatchSnapshot()
    })
  })
  describe('when container starts playing', () => {
    describe.each([
      ['muted autoplay', 0, { autoPlay: true }, true],
      ['audible autoplay', 50, { autoPlay: true }, false],
      ['muted not autoplay', 0, {}, false],
      ['audible not autoplay', 50, {}, false],
    ])('%s', (_, volume, playMetadata, shouldMount) => {
      beforeEach(() => {
        core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED)
        core.activeContainer.volume = volume
        core.activeContainer.emit(
          Events.CONTAINER_PLAY,
          'Container',
          playMetadata,
        )
      })
      it(`should ${shouldMount ? 'mount' : 'not mount'} to container`, () => {
        expect(
          core.activeContainer.$el.find('#gplayer-big-mute-button').length,
        ).toBe(shouldMount ? 1 : 0)
      })
    })
  })
  describe('when playback is stopped', () => {
    describe.each([
      ['from ui', { ui: true }, true],
      ['algorithmically', {}, false],
    ])('%s', (_, stopMetadata, shouldUnmount) => {
      beforeEach(() => {
        core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED)
        core.activeContainer.volume = 0
        core.activeContainer.emit(Events.CONTAINER_PLAY, 'Container', {
          autoPlay: true,
        })
        core.activeContainer.emit(
          Events.CONTAINER_STOP,
          'Container',
          stopMetadata,
        )
      })
      it(`should ${shouldUnmount ? 'unmount' : 'not unmount'}`, () => {
        expect(
          core.activeContainer.$el.find('#gplayer-big-mute-button').length,
        ).toBe(shouldUnmount ? 0 : 1)
      })
    })
  })
  describe('when playback is paused', () => {
    beforeEach(() => {
      core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED)
      core.activeContainer.volume = 0
      core.activeContainer.emit(Events.CONTAINER_PLAY, 'Container', {
        autoPlay: true,
      })
      core.activeContainer.emit(Events.CONTAINER_PAUSE, 'Container')
    })
    it('should unmount', () => {
      expect(
        core.activeContainer.$el.find('#gplayer-big-mute-button').length,
      ).toBe(0)
    })
  })
})
