import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Clips } from '../Clips'
import { createMockCore, createMockMediaControl } from '../../../testUtils'
import { Events } from '@clappr/core'

// import { LogTracer, Logger, setTracer } from '@gcorevideo/utils'

// Logger.enable('*')
// setTracer(new LogTracer('Clips.text'))

describe('Clips', () => {
  let core: any
  let mediaControl: any
  let clips: Clips
  beforeEach(() => {
    core = createMockCore({
      clips: {
        text: `
      00:00:00 Introduction
      00:05:00 Main part
      00:15:00 Conclusion
      `,
      },
    })
    mediaControl = createMockMediaControl(core)
    core.getPlugin.mockImplementation((name: string) => {
      if (name === 'media_control') return mediaControl
      return null
    })
    clips = new Clips(core)
    core.emit(Events.CORE_READY)
    core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED, core.activeContainer)
    vi.spyOn(core.activeContainer.$el, 'width').mockReturnValue(600)
    core.activeContainer.emit(Events.CONTAINER_TIMEUPDATE, {
      current: 0,
      total: 1200,
    })
  })
  it('should render indicator', () => {
    expect(clips.el.innerHTML).toMatchSnapshot()
  })
  it('should render notches on the seek bar', () => {
    const svg = clips.$el.find('svg')
    expect(svg).toBeDefined()
    expect(svg?.find('rect').length).toBe(3)
  })
  describe('as time progresses', () => {
    describe.each([
      [60, 'Introduction'],
      [310, 'Main part'],
      [1001, 'Conclusion'],
    ])('@%s', (time, expected) => {
      beforeEach(() => {
        core.activeContainer.emit(Events.CONTAINER_TIMEUPDATE, {
          current: time,
          total: 1200,
        })
      })
      it(`text should be "${expected}"`, () => {
        expect(clips.$el.find('#clips-text').text()).toBe(expected)
      })
    })
  })
  describe('when media control is rendered', () => {
    beforeEach(() => {
      mediaControl.trigger(Events.MEDIACONTROL_RENDERED)
    })
    it('should mount the indicator', () => {
      expect(mediaControl.slot).toHaveBeenCalledWith('clips', clips.$el)
    })
  })
})
