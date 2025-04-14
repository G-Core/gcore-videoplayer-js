import { MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest'

import { BottomGear, GearEvents } from '../BottomGear'
import { createMockCore, createMockMediaControl } from '../../../testUtils'
import { $, Events } from '@clappr/core'
import { ExtendedEvents } from '../../media-control/MediaControl'

// import { LogTracer, Logger, setTracer } from '@gcorevideo/utils'

// Logger.enable('*')
// setTracer(new LogTracer('BottomGear.test'))

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
  })
  describe('basically', () => {
    beforeEach(() => {
      bottomGear = new BottomGear(core)
      onGearRendered = vi.fn()
      bottomGear.on(GearEvents.RENDERED, onGearRendered, null)
      core.emit(Events.CORE_READY)
      bottomGear.addItem('test', null).html('<button>test</button>')
    })
    it('should render', () => {
      expect(bottomGear.el.innerHTML).toMatchSnapshot()
    })
    it('should render the gear menu hidden', () => {
      expect(bottomGear.$el.find('#gear-options-wrapper').css('display')).toBe(
        'none',
      )
    })
    it('should emit event in the next render cycle', async () => {
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
      it('should open the gear menu', () => {
        expect(
          bottomGear.$el.find('#gear-options-wrapper').css('display'),
        ).not.toBe('none')
        expect(bottomGear.$el.find('#gear-button').attr('aria-expanded')).toBe(
          'true',
        )
      })
      it('should trigger media control menu collapse', () => {
        expect(mediaControl.trigger).toHaveBeenCalledWith(
          ExtendedEvents.MEDIACONTROL_MENU_COLLAPSE,
          'bottom_gear',
        )
      })
    })
    describe('when clicked twice', () => {
      beforeEach(() => {
        bottomGear.$el.find('#gear-button').click()
        bottomGear.$el.find('#gear-button').click()
      })
      it('should collapse the gear menu', () => {
        expect(
          bottomGear.$el.find('#gear-options-wrapper').css('display'),
        ).toBe('none')
        expect(bottomGear.$el.find('#gear-button').attr('aria-expanded')).toBe(
          'false',
        )
      })
    })
  })
  describe('when there are no items', () => {
    beforeEach(() => {
      bottomGear = new BottomGear(core)
      core.emit(Events.CORE_READY)
    })
    it('should render hidden', () => {
      expect(bottomGear.$el.css('display')).toBe('none')
    })
    it('should show button after item is added', () => {
      bottomGear.addItem('test', null).html('<button>test</button>')
      expect(bottomGear.$el.css('display')).not.toBe('none')
    })
  })
  describe('when container is clicked', () => {
    beforeEach(async () => {
      bottomGear = new BottomGear(core)
      core.emit(Events.CORE_READY)
      bottomGear
        .addItem('test', $('<ul id="test-options"><li>Item</li></ul>'))
        .html('<button id="test-button">test</button>')
      bottomGear.$el.find('#gear-button').click()
    })
    describe('basically', () => {
      beforeEach(async () => {
        mediaControl.container.trigger(Events.CONTAINER_CLICK)
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      it('should collapse the gear menu', () => {
        expect(bottomGear.$el.find('#gear-options-wrapper').css('display')).toBe(
          'none',
        )
        expect(bottomGear.$el.find('#gear-button').attr('aria-expanded')).toBe(
          'false',
        )
        expect(bottomGear.$el.find('#test-options').css('display')).toBe('none')
      })
    })
    describe('when submenu is open', () => {
      beforeEach(async () => {
        // bottomGear.$el.find('#test-submenu').click()
        bottomGear.$el.find('#test-options').show(); // as if it was clicked
        await new Promise((resolve) => setTimeout(resolve, 0))
        mediaControl.container.trigger(Events.CONTAINER_CLICK)
      })
      it('should collapse it as well', () => {
        expect(bottomGear.$el.find('#test-options').css('display')).toBe(
          'none',
        )
        expect(bottomGear.$el.find('#gear-options').css('display')).not.toBe(
          'none',
        )
      })
    })
  })
})
