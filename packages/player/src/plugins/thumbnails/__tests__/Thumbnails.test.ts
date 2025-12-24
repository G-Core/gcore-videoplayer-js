import { describe, it, expect, beforeEach, vi } from 'vitest'

import { Events } from '@clappr/core'


import { createMockCore, createMockMediaControl } from '../../../testUtils'

import { Thumbnails } from '../Thumbnails'
import { loadImageDimensions } from '../utils'

// import { Logger, LogTracer, setTracer } from '@gcorevideo/utils'

// Logger.enable('*')
// setTracer(new LogTracer('Thumbnails.test'))

vi.mock('../utils.ts', () => ({
  loadImageDimensions: vi.fn().mockResolvedValue({ width: 600, height: 900 }),
}))

const baselineVTT = `1
00:00:00.000 --> 00:00:01.000
sprite.png#xywh=0,0,100,100

2
00:00:01.000 --> 00:00:02.000
sprite.png#xywh=100,0,100,100
`

const headerfulVTT = `WEBVTT

1
00:00:00.000 --> 00:00:01.000
sprite.png#xywh=0,0,100,100

2
00:00:01.000 --> 00:00:02.000
sprite.png#xywh=100,0,100,100
`

const blockfulVTT = `WEBVTT

STYLE
.cue { font-weight: bold; }

1
00:00:00.000 --> 00:00:01.000
sprite.png#xywh=0,0,100,100

NOTE
This is a note

2 - This is fancy cue ID
00:00:01.000 --> 00:00:02.000
sprite.png#xywh=100,0,100,100
`

const idlessVTT = `WEBVTT

00:00:00.000 --> 00:00:01.000
sprite.png#xywh=0,0,100,100

00:00:01.000 --> 00:00:02.000
sprite.png#xywh=100,0,100,100
`

const richcueVTT = `WEBVTT

00:00:00.000 --> 00:00:01.000 align:start size:100%
sprite.png#xywh=0,0,100,100

00:00:01.000 --> 00:00:02.000 align:center size:100%
sprite.png#xywh=100,0,100,100
`

const anomalousTimestampsVTT = `WEBVTT

00:00:00,000 --> 00:00:01,000 align:start size:100%
sprite.png#xywh=0,0,100,100

00:00:01,000 --> 00:00:02,000 align:center size:100%
sprite.png#xywh=100,0,100,100
`

describe('Thumbnails', () => {
  let core: any
  let mediaControl: any
  let thumbnails: Thumbnails
  describe.each([
    ['baseline VTT', baselineVTT],
    ['VTT where cues are without ids', idlessVTT],
    ['VTT with a WebVTT header', headerfulVTT],
    ['VTT with NOTE and STYLE blocks', blockfulVTT],
    ['VTT where cues have settings', richcueVTT],
    ['VTT with anomalous timestamps', anomalousTimestampsVTT],
  ])('%s', (name, vtt) => {
    beforeEach(() => {
      core = createMockCore({
        thumbnails: {
          backdropHeight: 100,
          spotlightHeight: 100,
          sprite: 'https://example.com/sprite.png',
          vtt,
        },
      })
      mediaControl = createMockMediaControl(core)
      core.getPlugin.mockImplementation((name) => {
        switch (name) {
          case 'media_control':
            return mediaControl
        }
      });
      thumbnails = new Thumbnails(core)
    })
    describe('loading', () => {
      beforeEach(async () => {
        core.emit(Events.CORE_READY)
        await new Promise(resolve => setTimeout(resolve, 1))
      })
      it('should render', () => {
        expect(thumbnails.$el.html()).toMatchSnapshot()
      })
      it('should mount along with media controls', () => {
        expect(core.$el.find('.scrub-thumbnails')).toHaveLength(1)
      })
      it('should load image dimensions', () => {
        expect(loadImageDimensions).toHaveBeenCalledWith('https://example.com/sprite.png')
      })
      it('should parse sprite sheet and create thumbnails', () => {
        const thumbs = thumbnails.$el.find('#thumbnails-carousel .thumbnail-container')
        expect(thumbs).toHaveLength(2)
      })
      it('should hide', () => {
        expect(thumbnails.$el.hasClass('hidden')).toBe(true)
      })
    })
    describe('update', () => {
      describe('when mouse pointer is over the scrubber', () => {
        beforeEach(async () => {
          core.emit(Events.CORE_READY)
          await new Promise(resolve => setTimeout(resolve, 1))
          mediaControl.container.getDuration.mockReturnValue(5)
          vi.spyOn(thumbnails.$el, 'width').mockReturnValue(300)
          mediaControl.trigger(Events.MEDIACONTROL_MOUSEMOVE_SEEKBAR, {}, 0.5)
        })
        it('should show thumbnails', () => {
          expect(thumbnails.$el.hasClass('hidden')).toBe(false)
        })
        it('should show the matching spotlight thumbnail', () => {
          expect(thumbnails.$el.find('#thumbnails-spotlight .thumbnail-container').css('background-position')).toBe('-100px 0px')
        })
      })
    })
  })
})
