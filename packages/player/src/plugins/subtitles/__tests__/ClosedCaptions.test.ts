import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClosedCaptions } from '../ClosedCaptions.js'
import { createMockCore, createMockMediaControl } from '../../../testUtils.js';

describe('ClosedCaptions', () => {
  let core: any;
  let mediaControl: any;
  let cc: ClosedCaptions;
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
      core.emit('core:ready')
      core.activePlayback.el = document.createElement('video')
      core.emit('core:active:container:changed', core.activeContainer)
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
          }
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
          }
        }
      ]
      core.activePlayback.emit('playback:subtitle:available')
      core.activeContainer.emit('container:subtitle:available')
    })
    it('should render', () => {
      expect(cc.el.innerHTML).toMatchSnapshot()
      expect(cc.$el.find('[data-cc-button]').length).toEqual(1)
      expect(mediaControl.putElement).toHaveBeenCalledWith('cc', cc.$el)
    })
  })
})