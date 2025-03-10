import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaControl, MediaControlElement } from '../MediaControl'
import { createMockCore } from '../../../testUtils'
import { LogTracer, Logger, setTracer } from '@gcorevideo/utils'

Logger.enable('*')
setTracer(new LogTracer('MediaControl.test'))

describe('MediaControl', () => {
  let core: any
  let mediaControl: MediaControl

  beforeEach(() => {
    core = createMockCore()
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
      // ['audiotracks' as MediaControlElement],
    ])('%s', (mcName) => {
      it('should put the element in the right panel', () => {
        const element = document.createElement('div')
        element.className = 'my-media-control'
        element.textContent = 'test'
        mediaControl.putElement(mcName, element)

        expect(mediaControl.el.innerHTML).toMatchSnapshot()
        expect(mediaControl.$el.find('.media-control-right-panel .my-media-control').length).toEqual(1)
      })
    })
  })
})
