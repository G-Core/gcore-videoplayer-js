import { MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest'

import { BottomGear, GearEvents } from '../BottomGear'
import { createMockCore, createMockMediaControl } from '../../../testUtils'

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
    bottomGear.on(GearEvents.RENDERED, onGearRendered, null)
    bottomGear.render()
  })
  it('should render', () => {
    expect(bottomGear.el.innerHTML).toMatchSnapshot()
  })
  it('should attach to media control', () => {
    expect(mediaControl.putElement).toHaveBeenCalledWith('gear', bottomGear.$el)
  })
  it('should emit event in the next cycle', async () => {
    expect(onGearRendered).not.toHaveBeenCalled()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onGearRendered).toHaveBeenCalled()
  })
  it('should render the gear menu hidden', () => {
    expect(bottomGear.$el.find('#gear-options-wrapper').css('display')).toBe(
      'none',
    )
  })
  describe('when clicked', () => {
    beforeEach(() => {
      bottomGear.$el.find('#gear-button').click()
    })
    it('should toggle the gear menu', () => {
      expect(bottomGear.$el.find('#gear-options-wrapper').css('display')).toBe(
        'block',
      )
    })
  })
})
