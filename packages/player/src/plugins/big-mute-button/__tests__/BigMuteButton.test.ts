import { beforeEach, describe, it, expect } from 'vitest'
import { Events } from '@clappr/core'

import { BigMuteButton } from '../BigMuteButton.js'
import { createMockCore } from '../../../testUtils.js'

describe('BigMuteButton', () => {
  let core: any
  let bmb: BigMuteButton
  describe('basically', () => {
    beforeEach(() => {
      core = createMockCore({})
      bmb = new BigMuteButton(core)
      // core.emit('core:ready')
      // core.emit('core:active:container:changed')
    })
    it('should render', () => {
      expect(bmb.$el.html()).toMatchSnapshot()
    })
  })
  describe('when container starts playing', () => {
    describe.each([
      ['muted autoplay', 0, { autoPlay: true }, true],
      ['audible autoplay', 50, { autoPlay: true }, false],
      ['muted not autoplay', 0, { }, false],
      ['audible not autoplay', 1, {}, false],
    ])("%s", (_, volume, playMetadata, shouldMount) => {
      beforeEach(() => {
        core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED)
        core.activeContainer.volume = volume
        core.activeContainer.emit(Events.CONTAINER_PLAY, 'Container', playMetadata)
      })
      it(`should ${shouldMount ? 'mount' : 'not mount'} to container`, () => {
        expect(core.activeContainer.$el.find('#gplayer-big-mute-button').length).toBe(shouldMount ? 1 : 0)
      })
    })
  })
})