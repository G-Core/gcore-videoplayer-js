import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PlaybackRate } from '../PlaybackRate'
import {
  createMockCore,
  createMockMediaControl,
  createMockPlugin,
} from '../../../testUtils'
import { $ } from '@clappr/core'
import { Logger, LogTracer, setTracer } from '@gcorevideo/utils'

Logger.enable('*')
setTracer(new LogTracer('PlaybackRate.test'))

describe('PlaybackRate', () => {
  let core: any
  let bottomGear: any
  beforeEach(() => {
    core = createMockCore()
    const mediaControl = createMockMediaControl(core)
    bottomGear = createMockGearPlugin()
    core.getPlugin.mockImplementation((name: string) => {
      if (name === 'bottom_gear') {
        return bottomGear
      }
      if (name === 'media_control') {
        return mediaControl
      }
      return null
    })
  })
  it('should render', () => {
    const playbackRate = new PlaybackRate(core)
    core.emit('core:ready')
    core.activePlayback.getPlaybackType.mockReturnValue('live')
    core.emit('core:active:container:changed')
    core.activePlayback.dvrEnabled = true
    core.activeContainer.emit('container:dvr', true)
    expect(playbackRate.el.innerHTML).toMatchSnapshot()
    expect(bottomGear.getElement).toHaveBeenCalledWith('rate')
    expect(
      bottomGear.$el
        .find('[data-rate]')
        .text()
        .replace(/\/assets.*\.svg/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    ).toEqual('playback_rate 1x')
  })
})

function createMockGearPlugin() {
  const elements = {
    nerd: $(document.createElement('li')).attr('data-nerd', 'nerd'),
    quality: $(document.createElement('li')).attr('data-quality', 'quality'),
    rate: $(document.createElement('li')).attr('data-rate', 'rate'),
  }
  const $el = $(document.createElement('ul'))
  $el.append(elements.nerd, elements.quality, elements.rate)
  const plugin = Object.assign(createMockPlugin(), {
    setContent: vi.fn(),
    getElement: vi.fn((name: string) => elements[name]),
    $el,
  })
  return plugin
}
