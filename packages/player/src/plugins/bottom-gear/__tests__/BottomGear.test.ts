import { MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest'

import { BottomGear } from '../BottomGear'
import { createMockCore, createMockMediaControl } from '../../../testUtils'
import { MediaControlEvents } from '../../media-control/MediaControl'

describe('BottomGear', () => {
  let mediaControl: any
  let core: any
  let bottomGear: BottomGear
  let onGearRendered: MockedFunction<() => void>
  beforeEach(() => {
    core = createMockCore()
    mediaControl = createMockMediaControl(core)
    core.getPlugin = vi
      .fn()
      .mockImplementation((name) =>
        name === 'media_control' ? mediaControl : null,
      )
    bottomGear = new BottomGear(core)
    onGearRendered = vi.fn()
    mediaControl.on(MediaControlEvents.MEDIACONTROL_GEAR_RENDERED, onGearRendered, null)
    bottomGear.render()
  })
  it('should render', () => {
    expect(bottomGear.el.innerHTML).toMatchSnapshot()
  })
  it('should attach to media control', () => {
    const gearElement = mediaControl.getElement('gear')
    expect(gearElement[0].innerHTML).not.toEqual('')
    expect(gearElement[0].innerHTML).toMatchSnapshot()
  })
  it('should emit event', () => {
    expect(onGearRendered).toHaveBeenCalled()
  })
})
