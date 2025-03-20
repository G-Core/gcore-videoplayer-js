import { MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest'

import { BottomGear, GearEvents } from '../BottomGear'
import { createMockCore, createMockMediaControl } from '../../../testUtils'
import { Events } from '@clappr/core'

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
    core.emit(Events.CORE_READY)
  })
  it('should render', () => {
    expect(bottomGear.el.innerHTML).toMatchSnapshot()
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
  describe('until media control is rendered', () => {
    it('should not attach to media control', () => {
      expect(mediaControl.mount).not.toHaveBeenCalledWith(
        'gear',
        expect.anything(),
      )
    })
  })
  describe('when media control is rendered', () => {
    beforeEach(() => {
      mediaControl.trigger(Events.MEDIACONTROL_RENDERED)
    })
    it('should attach to media control', () => {
      expect(mediaControl.mount).toHaveBeenCalledWith('gear', bottomGear.$el)
    })
  })
  describe('when clicked', () => {
    beforeEach(() => {
      bottomGear.$el.find('#gear-button').click()
    })
    it('should toggle the gear menu', () => {
      expect(
        bottomGear.$el.find('#gear-options-wrapper').css('display'),
      ).not.toBe('none')
    })
  })
})
