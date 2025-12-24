import {
  UICorePlugin,
  Events,
  template,
  $,
  Container,
  Core,
} from '@clappr/core'
import { trace } from '@gcorevideo/utils'
import { WebVTT } from 'videojs-vtt.js'
import assert from 'assert'

import { TimeValue } from '../../playback.types.js'

import { CLAPPR_VERSION } from '../../build.js'

import pluginHtml from '../../../assets/thumbnails/scrub-thumbnails.ejs'
import '../../../assets/thumbnails/style.scss'
import { ZeptoResult } from '../../types.js'
import { MediaControl } from '../media-control/MediaControl.js'
import { Clips } from '../clips/Clips.js'
import { loadImageDimensions } from './utils.js'

/**
 * Plugin configuration options for the thumbnails plugin.
 * @public
 * @remarks
 * Example of a VTT file:
 * ```text
 * 1
 * 00:00:00,000 --> 00:00:10,000
 * 3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,0,100,56
 *
 * 2
 * 00:00:10,000 --> 00:00:20,000
 * 3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,0,100,56
 *
 * ```
 */
export interface ThumbnailsPluginSettings {
  backdropHeight?: number
  backdropMaxOpacity?: number
  backdropMinOpacity?: number
  spotlightHeight?: number
  sprite: string
  /**
   * The VTT file to use for the thumbnails.
   */
  vtt: string
}

type ThumbnailDesc = {
  url: string
  time: number
  w: number
  h: number
  x: number
  y: number
  duration?: number
  imageH?: number
}

const T = 'plugins.thumbnails'

/**
 * `PLUGIN` that displays the thumbnails of the video when available.
 * @public
 * @remarks
 * The plugin needs specially crafted VTT file with a thumbnail sprite sheet to work.
 * The VTT cues refer to a thumbnail, an area within the sprite sheet, to associate with a time span.
 *
 * Configuration options - {@link ThumbnailsPluginSettings}
 *
 * @example
 * ```ts
 * import { Thumbnails } from '@gcorevideo/player'
 *
 * Player.registerPlugin(Thumbnails)
 *
 * new Player({
 *   thumbnails: {
 *     backdropHeight: 200,
 *     backdropMinOpacity: 0.9,
 *     backdropMaxOpacity: 0.99,
 *     spotlightHeight: 100,
 *     vtt: '1\n00:00:00,000 --> 00:00:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,0,100,56\n\n2\n00:00:10,000 --> 00:00:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,0,100,56\n\n3\n00:00:20,000 --> 00:00:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,0,100,56\n\n4\n00:00:30,000 --> 00:00:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,0,100,56\n\n5\n00:00:40,000 --> 00:00:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,0,100,56\n\n6\n00:00:50,000 --> 00:01:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,0,100,56\n\n7\n00:01:00,000 --> 00:01:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,0,100,56\n\n8\n00:01:10,000 --> 00:01:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,56,100,56\n\n9\n00:01:20,000 --> 00:01:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,56,100,56\n\n10\n00:01:30,000 --> 00:01:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,56,100,56\n\n11\n00:01:40,000 --> 00:01:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,56,100,56\n\n12\n00:01:50,000 --> 00:02:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,56,100,56\n\n13\n00:02:00,000 --> 00:02:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,56,100,56\n\n14\n00:02:10,000 --> 00:02:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,56,100,56\n\n15\n00:02:20,000 --> 00:02:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,112,100,56\n\n16\n00:02:30,000 --> 00:02:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,112,100,56\n\n17\n00:02:40,000 --> 00:02:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,112,100,56\n\n18\n00:02:50,000 --> 00:03:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,112,100,56\n\n19\n00:03:00,000 --> 00:03:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,112,100,56\n\n20\n00:03:10,000 --> 00:03:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,112,100,56\n\n21\n00:03:20,000 --> 00:03:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,112,100,56\n\n22\n00:03:30,000 --> 00:03:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,168,100,56\n\n23\n00:03:40,000 --> 00:03:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,168,100,56\n\n24\n00:03:50,000 --> 00:04:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,168,100,56\n\n25\n00:04:00,000 --> 00:04:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,168,100,56\n\n26\n00:04:10,000 --> 00:04:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,168,100,56\n\n27\n00:04:20,000 --> 00:04:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,168,100,56\n\n28\n00:04:30,000 --> 00:04:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,168,100,56\n\n29\n00:04:40,000 --> 00:04:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,224,100,56\n\n30\n00:04:50,000 --> 00:05:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,224,100,56\n\n31\n00:05:00,000 --> 00:05:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,224,100,56\n\n32\n00:05:10,000 --> 00:05:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,224,100,56\n\n33\n00:05:20,000 --> 00:05:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,224,100,56\n\n34\n00:05:30,000 --> 00:05:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,224,100,56\n\n35\n00:05:40,000 --> 00:05:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,224,100,56\n\n36\n00:05:50,000 --> 00:06:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,280,100,56\n\n37\n00:06:00,000 --> 00:06:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,280,100,56\n\n38\n00:06:10,000 --> 00:06:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,280,100,56\n\n39\n00:06:20,000 --> 00:06:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,280,100,56\n\n40\n00:06:30,000 --> 00:06:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,280,100,56\n\n41\n00:06:40,000 --> 00:06:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,280,100,56\n\n42\n00:06:50,000 --> 00:07:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,280,100,56\n\n43\n00:07:00,000 --> 00:07:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=0,336,100,56\n\n44\n00:07:10,000 --> 00:07:20,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=100,336,100,56\n\n45\n00:07:20,000 --> 00:07:30,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=200,336,100,56\n\n46\n00:07:30,000 --> 00:07:40,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=300,336,100,56\n\n47\n00:07:40,000 --> 00:07:50,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=400,336,100,56\n\n48\n00:07:50,000 --> 00:08:00,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=500,336,100,56\n\n49\n00:08:00,000 --> 00:08:10,000\n3dk4NsRt6vWsffEr_sprite.jpg#xywh=600,336,100,56\n',
 *     sprite:
 *      'https://static.gvideo.co/videoplatform/sprites/2675/2452164_3dk4NsRt6vWsffEr.mp4_sprite.jpg',
 *   },
 * })

 * ```
 */
export class Thumbnails extends UICorePlugin {
  private $backdropCarouselImgs: ZeptoResult[] = []

  private spriteSheetHeight: number = 0

  private spriteSheetWidth: number = 0

  private hoverPosition = 0

  private showing = false

  private thumbsLoaded = false

  private spotlightHeight = 0

  private backdropHeight = 0

  private thumbs: ThumbnailDesc[] = []

  /**
   * @internal
   */
  get name() {
    return 'thumbnails'
  }

  /**
   * @internal
   */
  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  /**
   * @internal
   */
  override get attributes() {
    return {
      class: 'scrub-thumbnails',
    }
  }

  private static readonly template = template(pluginHtml)

  constructor(core: Core) {
    super(core)
    this.backdropHeight = this.options.thumbnails?.backdropHeight ?? 0
  }

  /*
   * Helper to build the "thumbs" property for a sprite sheet.
   *
   * spriteSheetUrl- The url to the sprite sheet image
   * numThumbs- The number of thumbnails on the sprite sheet
   * thumbWidth- The width of each thumbnail.
   * thumbHeight- The height of each thumbnail.
   * numColumns- The number of columns in the sprite sheet.
   * timeInterval- The interval (in seconds) between the thumbnails.
   * startTime- The time (in seconds) that the first thumbnail represents. (defaults to 0)
   */
  private buildSpriteConfig(
    vtt: ParsedVTT[],
    baseUrl: string,
  ): ThumbnailDesc[] {
    const thumbs: ThumbnailDesc[] = []

    for (const vt of vtt) {
      const el = vt.text
      if (el) {
        const m = el.match(/(\w+)#xywh=(\d+,\d+,\d+,\d+)/)
        if (m) {
          const coor = m[2].split(',')
          const w = parseInt(coor[2], 10)
          const h = parseInt(coor[3], 10)
          if (w > 0 && h > 0) {
            thumbs.push({
              // TODO handle relative URLs
              // url: new URL(m[0], baseUrl).toString(),
              url: baseUrl,
              time: vt.start,
              w,
              h,
              x: parseInt(coor[0], 10) || 0,
              y: parseInt(coor[1], 10) || 0,
            })
          }
        }
      }
    }

    return thumbs
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenToOnce(this.core, Events.CORE_READY, this.onCoreReady)
  }

  private bindContainerEvents(container: Container) {
    this.listenTo(container, Events.CONTAINER_TIMEUPDATE, this.update)
  }

  private onCoreReady() {
    const mediaControl = this.core.getPlugin('media_control') as
      | MediaControl
      | undefined
    assert(
      mediaControl,
      `MediaControl is required for ${this.name} plugin to work`,
    )

    if (
      !this.options.thumbnails ||
      !this.options.thumbnails.sprite ||
      !this.options.thumbnails.vtt
    ) {
      trace(
        `${T} misconfigured: options.thumbnails.sprite and options.thumbnails.vtt are required`,
      )
      this.destroy()
      return
    }
    const { sprite: spriteSheet, vtt } = this.options.thumbnails
    this.thumbs = this.buildSpriteConfig(parseVTT(vtt), spriteSheet)
    if (!this.thumbs.length) {
      trace(`${T} failed to parse the sprite sheet`)
      this.destroy()
      return
    }
    this.spotlightHeight = this.options.thumbnails?.spotlightHeight ?? 0
    this.loadSpriteSheet(spriteSheet).then(() => {
      this.thumbsLoaded = true
      this.spotlightHeight = this.spotlightHeight
        ? Math.min(this.spotlightHeight, this.thumbs[0].h)
        : this.thumbs[0].h
      this.init()
    })
    this.listenTo(
      mediaControl,
      Events.MEDIACONTROL_MOUSEMOVE_SEEKBAR,
      this.onMouseMoveSeekbar,
    )
    this.listenTo(
      mediaControl,
      Events.MEDIACONTROL_MOUSELEAVE_SEEKBAR,
      this.onMouseLeave,
    )
    this.listenTo(mediaControl, Events.MEDIACONTROL_RENDERED, this.init)
    this.listenTo(mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, () =>
      this.onContainerChanged(mediaControl.container),
    )
  }

  private async loadSpriteSheet(spriteSheetUrl: string): Promise<void> {
    return loadImageDimensions(spriteSheetUrl).then(({ height, width }) => {
      this.spriteSheetHeight = height
      this.spriteSheetWidth = width
    })
  }

  private onContainerChanged(container: Container) {
    this.bindContainerEvents(container)
  }

  private init() {
    if (!this.thumbsLoaded) {
      // init() will be called when the thumbs are loaded,
      // and whenever the media control rendered event is fired as just before this the dom elements get wiped in IE (https://github.com/tjenkinson/clappr-thumbnails-plugin/issues/5)
      return
    }
    // Init the backdropCarousel as array to keep reference of thumbnail images
    this.$backdropCarouselImgs = []
    this.fixElements()
    this.loadBackdrop()
    this.update()
  }

  private mount() {
    const mediaControl = this.core.getPlugin('media_control') as MediaControl
    mediaControl.$el.find('.seek-time').css('bottom', 56) // TODO check the offset
    mediaControl.$el.first().after(this.$el)
  }

  private onMouseMoveSeekbar(_: MouseEvent, pos: number) {
    this.hoverPosition = pos
    this.showing = true
    this.update()
  }

  private onMouseLeave() {
    this.showing = false
    this.update()
  }

  // builds a dom element which represents the thumbnail
  // scaled to the given height
  private buildThumbImage(
    thumb: ThumbnailDesc,
    height: number,
    $ref?: ZeptoResult,
  ) {
    const scaleFactor = height / thumb.h
    const $container =
      $ref && $ref.length ? $ref : $('<div />').addClass('thumbnail-container')

    $container.css('width', thumb.w * scaleFactor)
    $container.css('height', height)
    $container.css({
      backgroundImage: `url(${thumb.url})`,
      backgroundSize: `${Math.floor(
        this.spriteSheetWidth * scaleFactor,
      )}px ${Math.floor(this.spriteSheetHeight * scaleFactor)}px`,
      backgroundPosition: `-${Math.floor(
        thumb.x * scaleFactor,
      )}px -${Math.floor(thumb.y * scaleFactor)}px`,
    })

    return $container
  }

  private loadBackdrop() {
    if (!this.backdropHeight) {
      // disabled
      return
    }

    // append each of the thumbnails to the backdrop carousel
    const $carousel = this.$el.find('#thumbnails-carousel')

    for (const thumb of this.thumbs) {
      const $img = this.buildThumbImage(thumb, this.backdropHeight)
      // Keep reference to the thumbnail
      this.$backdropCarouselImgs.push($img)
      // Add thumbnail to DOM
      $carousel.append($img)
    }
  }

  private setText(time: TimeValue) {
    const clips = this.core.getPlugin('clips') as Clips
    if (clips) {
      const txt = clips.getText(time)
      this.$el.find('#thumbnails-text').text(txt ?? '')
    }
  }

  // calculate how far along the carousel should currently be slid
  // depending on where the user is hovering on the progress bar
  private updateCarousel() {
    if (!this.backdropHeight) {
      // disabled
      return
    }

    const mediaControl = this.core.getPlugin('media_control') as MediaControl

    const videoDuration = mediaControl.container.getDuration()
    const startTimeOffset = mediaControl.container.getStartTimeOffset()
    // the time into the video at the current hover position
    const hoverTime = startTimeOffset + videoDuration * this.hoverPosition
    const $backdrop = this.$el.find('#thumbnails-backdrop')
    const backdropWidth = $backdrop.width()
    const $carousel = this.$el.find('#thumbnails-carousel')
    const carouselWidth = $carousel.width()

    // slide the carousel so that the image on the carousel that is above where the person
    // is hovering maps to that position in time.
    // Thumbnails may not be distributed at even times along the video

    // assuming that each thumbnail has the same width
    const thumbWidth = carouselWidth / this.thumbs.length

    // determine which thumbnail applies to the current time
    const thumbIndex = this.getThumbIndexForTime(hoverTime)
    const thumb = this.thumbs[thumbIndex]
    // the last thumbnail duration will be null as it can't be determined
    // e.g the duration of the video may increase over time (live stream)
    // so calculate the duration now so this last thumbnail lasts till the end
    const thumbDuration =
      thumb.duration ??
      Math.max(videoDuration + startTimeOffset - thumb.time, 0)

    // determine how far accross that thumbnail we are
    const timeIntoThumb = hoverTime - thumb.time
    const positionInThumb = timeIntoThumb / thumbDuration
    const xCoordInThumb = thumbWidth * positionInThumb

    // now calculate the position along carousel that we want to be above the hover position
    const xCoordInCarousel = thumbIndex * thumbWidth + xCoordInThumb
    // and finally the position of the carousel when the hover position is taken in to consideration
    const carouselXCoord = xCoordInCarousel - this.hoverPosition * backdropWidth

    $carousel.css('left', -carouselXCoord) // TODO +px

    const maxOpacity = this.options.thumbnails.backdropMaxOpacity ?? 0.6
    const minOpacity = this.options.thumbnails.backdropMinOpacity ?? 0.08

    // now update the transparencies so that they fade in around the active one
    for (let i = 0; i < this.thumbs.length; i++) {
      const thumbXCoord = thumbWidth * i
      let distance = thumbXCoord - xCoordInCarousel

      if (distance < 0) {
        // adjust so that distance is always a measure away from
        // each side of the active thumbnail
        // at every point on the active thumbnail the distance should
        // be 0
        distance = Math.min(0, distance + thumbWidth)
      }
      // fade over the width of 2 thumbnails
      const opacity = Math.max(
        maxOpacity - Math.abs(distance) / (2 * thumbWidth),
        minOpacity,
      )

      this.$backdropCarouselImgs[i].css('opacity', opacity)
    }
  }

  private updateSpotlightThumb() {
    if (!this.spotlightHeight) {
      // disabled
      return
    }

    const mediaControl = this.core.getPlugin('media_control') as MediaControl
    const videoDuration = mediaControl.container.getDuration()
    // the time into the video at the current hover position
    const startTimeOffset = mediaControl.container.getStartTimeOffset()
    const hoverTime = startTimeOffset + videoDuration * this.hoverPosition

    this.setText(hoverTime)

    // determine which thumbnail applies to the current time
    const thumbIndex = this.getThumbIndexForTime(hoverTime)
    const thumb = this.thumbs[thumbIndex]

    const $spotlight = this.$el.find('#thumbnails-spotlight')

    this.buildThumbImage(
      thumb,
      this.spotlightHeight,
      $spotlight.find('.thumbnail-container'),
    ).appendTo($spotlight)

    const elWidth = this.$el.width()
    const thumbWidth = $spotlight.width()
    const thumbHeight = $spotlight.height()

    // adjust so the entire thumbnail is always visible
    const spotlightXPos = Math.max(
      Math.min(
        elWidth * this.hoverPosition - thumbWidth / 2,
        elWidth - thumbWidth,
      ),
      0,
    )

    $spotlight.css('left', spotlightXPos)

    const $textThumbnail = this.$el.find('#thumbnails-text')
    $textThumbnail.css('left', spotlightXPos)
    $textThumbnail.css('width', thumbWidth)
    $textThumbnail.css('bottom', thumbHeight + 1)
  }

  // returns the thumbnail which represents a time in the video
  // or null if there is no thumbnail that can represent the time
  private getThumbIndexForTime(time: TimeValue) {
    for (let i = this.thumbs.length - 1; i >= 0; i--) {
      const thumb = this.thumbs[i]

      if (thumb.time <= time) {
        return i
      }
    }

    // stretch the first thumbnail back to the start
    return 0
  }

  private update() {
    if (!this.thumbsLoaded) {
      return
    }
    if (this.showing && this.thumbs.length > 0) {
      this.updateCarousel()
      this.updateSpotlightThumb()
      this.$el.removeClass('hidden')
    } else {
      this.$el.addClass('hidden')
    }
  }

  private fixElements() {
    const $spotlight = this.$el.find('#thumbnails-spotlight')
    if (this.spotlightHeight) {
      $spotlight.css('height', this.spotlightHeight)
    } else {
      $spotlight.remove()
    }
    const $backdrop = this.$el.find('#thumbnails-backdrop')
    if (this.backdropHeight) {
      $backdrop.css('height', this.backdropHeight)
    } else {
      $backdrop.remove()
    }
    this.mount()
  }

  private get shouldRender() {
    return (
      this.options.thumbnails &&
      this.options.thumbnails.sprite &&
      this.options.thumbnails.vtt
    )
  }

  override render() {
    if (!this.shouldRender) {
      return this
    }
    this.$el.html(Thumbnails.template())
    this.$el.addClass('hidden')

    return this
  }
}

type ParsedVTT = {
  id: string;
  start: number;
  end: number;
  text: string;
}


function parseVTT(vtt: string): ParsedVTT[] {
  const correctedVTT = vtt.startsWith('WEBVTT') ? vtt : 'WEBVTT\n\n' + vtt;
  const parser = new WebVTT.Parser(window);
  const cues: ParsedVTT[] = [];
  (parser as any).oncue = (cue: any) => {
    cues.push({
      id: cue.id,
      start: cue.startTime,
      end: cue.endTime,
      text: cue.text
    });
  };

  // TextEncoder is available in all modern browsers and Node >=v11
  const uint8Array = typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(correctedVTT)
    : Buffer.from(correctedVTT, 'utf-8');
  parser.parse(uint8Array as any);
  parser.flush();

  return cues;
}
