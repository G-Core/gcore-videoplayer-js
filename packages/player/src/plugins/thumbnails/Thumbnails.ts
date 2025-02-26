import { UICorePlugin, Events, template, $, Container } from '@clappr/core'
import { reportError, trace } from '@gcorevideo/utils'
import parseSRT, { type ParsedSRT } from 'parse-srt'

import { TimeValue } from '../../playback.types.js'

import { CLAPPR_VERSION } from '../../build.js'

import pluginHtml from '../../../assets/thumbnails/scrub-thumbnails.ejs'
import '../../../assets/thumbnails/style.scss'
import { ZeptoResult } from '../../types.js'
import { getPageX } from '../utils.js'

/**
 * Plugin configuration options for the thumbnails plugin.
 * @beta
 */
export type ThumbnailsPluginSettings = {
  backdropHeight: number
  backdropMaxOpacity: number
  backdropMinOpacity: number
  spotlightHeight: number
  sprite: string
  vtt: string
}

type Thumb = {
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
 * @beta
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
  private _$spotlight: ZeptoResult | null = null

  private _$backdrop: ZeptoResult | null = null

  private $container: ZeptoResult | null = null

  private $img: ZeptoResult | null = null

  private _$carousel: ZeptoResult | null = null

  private $textThumbnail: ZeptoResult | null = null

  private _$backdropCarouselImgs: ZeptoResult[] = []

  private spriteSheetHeight: number = 0

  private _hoverPosition = 0

  private _show = false

  private _thumbsLoaded = false

  private _oldContainer: Container | null = null

  private _thumbs: Thumb[] = []

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
      class: this.name,
    }
  }

  private static readonly template = template(pluginHtml)

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
  // buildSpriteConfig(vtt, spriteSheetUrl, numThumbs, thumbWidth, thumbHeight, numColumns, timeInterval, startTime) {
  private buildSpriteConfig(vtt: ParsedSRT[], spriteSheetUrl: string): Thumb[] {
    const thumbs: Thumb[] = []
    // let coor: string[] = [];

    for (const vt of vtt) {
      const el = vt.text
      // if (el && el.search(/\d*,\d*,\d*,\d*/g) > -1) {
      //   el = el.match(/\d*,\d*,\d*,\d*/g)[0];
      //   coor = el.split(',');
      // }
      if (el) {
        const m = el.match(/xywh=\d*,\d*,\d*,\d*/g)
        if (m) {
          const coor = m[0].split(',')
          const w = parseInt(coor[2], 10)
          const h = parseInt(coor[3], 10)
          if (w > 0 && h > 0) {
            thumbs.push({
              url: spriteSheetUrl,
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

  // TODO check if seek enabled

  /**
   * @internal
   */
  override bindEvents() {
    this.listenToOnce(this.core, Events.CORE_READY, this._onCoreReady)
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_MOUSEMOVE_SEEKBAR,
      this._onMouseMove,
    )
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_MOUSELEAVE_SEEKBAR,
      this._onMouseLeave,
    )
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_RENDERED,
      this._init,
    )
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_CONTAINERCHANGED,
      this._onMediaControlContainerChanged,
    )
  }

  private _bindContainerEvents() {
    if (this._oldContainer) {
      this.stopListening(
        this._oldContainer,
        Events.CONTAINER_TIMEUPDATE,
        this._renderPlugin,
      )
    }
    this._oldContainer = this.core.mediaControl.container
    this.listenTo(
      this.core.mediaControl.container,
      Events.CONTAINER_TIMEUPDATE,
      this._renderPlugin,
    )
  }

  private _onCoreReady() {
    try {
      if (
        !this.options.thumbnails ||
        !this.options.thumbnails.sprite ||
        !this.options.thumbnails.vtt
      ) {
        this.destroy()

        return
      }
    } catch (error) {
      reportError(error)

      return
    }
    // TODO options
    const spriteSheet = this.options.thumbnails.sprite
    this._thumbs = this.buildSpriteConfig(
      parseSRT(this.options.thumbnails.vtt),
      spriteSheet,
    )
    if (!this._thumbs.length) {
      this.destroy()
      return
    }
    this.loadSpriteSheet(spriteSheet).then(() => {
      this._thumbsLoaded = true
      this.core.options.thumbnails.spotlightHeight = this._thumbs[0].h
      this._init()
    })
  }

  private async loadSpriteSheet(spriteSheetUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        this.spriteSheetHeight = img.height
        resolve()
      }
      img.onerror = reject
      img.src = spriteSheetUrl
    })
  }

  private _onMediaControlContainerChanged() {
    this._bindContainerEvents()
  }

  private _init() {
    if (!this._thumbsLoaded) {
      // _init() will be called when the thumbs are loaded,
      // and whenever the media control rendered event is fired as just before this the dom elements get wiped in IE (https://github.com/tjenkinson/clappr-thumbnails-plugin/issues/5)
      return
    }
    // Init the backdropCarousel as array to keep reference of thumbnail images
    this._$backdropCarouselImgs = []
    // create/recreate the dom elements for the plugin
    this._createElements()
    this._loadBackdrop()
    this._renderPlugin()
  }

  private _getOptions(): ThumbnailsPluginSettings {
    if (!('thumbnails' in this.core.options)) {
      throw "'thumbnail property missing from options object."
    }

    return this.core.options.thumbnails
  }

  private _appendElToMediaControl() {
    // insert after the background
    this.core.mediaControl.$el.find('.seek-time').css('bottom', 56)
    this.core.mediaControl.$el.first().after(this.el)
  }

  private _onMouseMove(e: MouseEvent) {
    // trace(`${T} _onMouseMove`, {
    //   e: (e as any).name,
    //   t: typeof e,
    //   t2: typeof arguments[1],
    // });
    this._calculateHoverPosition(e)
    this._show = true
    this._renderPlugin()
  }

  private _onMouseLeave() {
    this._show = false
    this._renderPlugin()
  }

  private _calculateHoverPosition(e: MouseEvent) {
    const offset =
      getPageX(e) - this.core.mediaControl.$seekBarContainer.offset().left

    // proportion into the seek bar that the mouse is hovered over 0-1
    this._hoverPosition = Math.min(
      1,
      Math.max(offset / this.core.mediaControl.$seekBarContainer.width(), 0),
    )
  }

  // private _buildThumbsFromOptions() {
  //   const thumbs = this._thumbs;
  //   const promises = thumbs.map((thumb) => {
  //     return this._addThumbFromSrc(thumb);
  //   });

  //   return Promise.all(promises);
  // }

  // private _addThumbFromSrc(thumbSrc) {
  //   return new Promise((resolve, reject) => {
  //     const img = new Image();

  //     img.onload = () => {
  //       resolve(img);
  //     };
  //     img.onerror = reject;
  //     img.src = thumbSrc.url;
  //   }).then((img) => {
  //     const startTime = thumbSrc.time;
  //     // determine the thumb index
  //     let index = null;

  //     this._thumbs.some((thumb, i) => {
  //       if (startTime < thumb.time) {
  //         index = i;

  //         return true;
  //       }

  //       return false;
  //     });
  //     if (index === null) {
  //       index = this._thumbs.length;
  //     }

  //     const next = index < this._thumbs.length ? this._thumbs[index] : null;
  //     const prev = index > 0 ? this._thumbs[index - 1] : null;

  //     if (prev) {
  //       // update the duration of the previous thumbnail
  //       prev.duration = startTime - prev.time;
  //     }
  //     // the duration this thumb lasts for
  //     // if it is the last thumb then duration will be null
  //     const duration = next ? next.time - thumbSrc.time : null;
  //     const imageW = img.width;
  //     const imageH = img.height;
  //     const thumb = {
  //       imageW: imageW, // actual width of image
  //       imageH: imageH, // actual height of image
  //       x: thumbSrc.x || 0, // x coord in image of sprite
  //       y: thumbSrc.y || 0, // y coord in image of sprite
  //       w: thumbSrc.w || imageW, // width of sprite
  //       h: thumbSrc.h || imageH, // height of sprite
  //       url: thumbSrc.url,
  //       time: startTime, // time this thumb represents
  //       duration: duration, // how long (from time) this thumb represents
  //       src: thumbSrc
  //     };

  //     this._thumbs.splice(index, 0, thumb);

  //     return thumb;
  //   });
  // }

  // builds a dom element which represents the thumbnail
  // scaled to the provided height
  private _buildImg(thumb: Thumb, height: number) {
    const scaleFactor = height / thumb.h

    if (!this.$img) {
      this.$img = $('<img />').addClass('thumbnail-img').attr('src', thumb.url)
    }

    // the container will contain the image positioned so that the correct sprite
    // is visible
    if (!this.$container) {
      this.$container = $('<div />').addClass('thumbnail-container')
    }

    this.$container.css('width', thumb.w * scaleFactor)
    this.$container.css('height', height)
    this.$img.css({
      height: this.spriteSheetHeight * scaleFactor,
      left: -1 * thumb.x * scaleFactor,
      top: -1 * thumb.y * scaleFactor,
    })
    if (this.$container.find(this.$img).length === 0) {
      this.$container.append(this.$img)
    }

    return this.$container
  }

  private _loadBackdrop() {
    if (!this._getOptions().backdropHeight) {
      // disabled
      return
    }

    // append each of the thumbnails to the backdrop carousel
    const $carousel = this._$carousel

    for (const thumb of this._thumbs) {
      const $img = this._buildImg(thumb, this._getOptions().backdropHeight)

      // Keep reference to thumbnail
      this._$backdropCarouselImgs.push($img)
      // Add thumbnail to DOM
      $carousel.append($img)
    }
  }

  private setText(time: TimeValue) {
    if (this.core.getPlugin('clips')) {
      const txt = this.core.getPlugin('clips').getText(time)

      this.$textThumbnail.text(txt)
    }
  }

  // calculate how far along the carousel should currently be slid
  // depending on where the user is hovering on the progress bar
  private _updateCarousel() {
    trace(`${T} _updateCarousel`, {
      backdropHeight: this._getOptions().backdropHeight,
    })
    if (!this._getOptions().backdropHeight) {
      // disabled
      return
    }

    const hoverPosition = this._hoverPosition
    const videoDuration = this.core.mediaControl.container.getDuration()
    const startTimeOffset =
      this.core.mediaControl.container.getStartTimeOffset()
    // the time into the video at the current hover position
    const hoverTime = startTimeOffset + videoDuration * hoverPosition
    const backdropWidth = this._$backdrop.width()
    const $carousel = this._$carousel
    const carouselWidth = $carousel.width()

    // slide the carousel so that the image on the carousel that is above where the person
    // is hovering maps to that position in time.
    // Thumbnails may not be distributed at even times along the video
    const thumbs = this._thumbs

    // assuming that each thumbnail has the same width
    const thumbWidth = carouselWidth / thumbs.length

    // determine which thumbnail applies to the current time
    const thumbIndex = this._getThumbIndexForTime(hoverTime)
    const thumb = thumbs[thumbIndex]
    let thumbDuration = thumb.duration

    if (!thumbDuration) {
      // the last thumbnail duration will be null as it can't be determined
      // e.g the duration of the video may increase over time (live stream)
      // so calculate the duration now so this last thumbnail lasts till the end
      thumbDuration = Math.max(videoDuration + startTimeOffset - thumb.time, 0)
    }

    // determine how far accross that thumbnail we are
    const timeIntoThumb = hoverTime - thumb.time
    const positionInThumb = timeIntoThumb / thumbDuration
    const xCoordInThumb = thumbWidth * positionInThumb

    // now calculate the position along carousel that we want to be above the hover position
    const xCoordInCarousel = thumbIndex * thumbWidth + xCoordInThumb
    // and finally the position of the carousel when the hover position is taken in to consideration
    const carouselXCoord = xCoordInCarousel - hoverPosition * backdropWidth

    $carousel.css('left', -carouselXCoord)

    const maxOpacity = this._getOptions().backdropMaxOpacity || 0.6
    const minOpacity = this._getOptions().backdropMinOpacity || 0.08

    // now update the transparencies so that they fade in around the active one
    for (let i = 0; i < thumbs.length; i++) {
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

      this._$backdropCarouselImgs[i].css('opacity', opacity)
    }
  }

  private _updateSpotlightThumb() {
    trace(`${T} _updateSpotlightThumb`, {
      spotlightHeight: this._getOptions().spotlightHeight,
    })
    if (!this._getOptions().spotlightHeight) {
      // disabled
      return
    }

    const hoverPosition = this._hoverPosition
    const videoDuration = this.core.mediaControl.container.getDuration()
    // the time into the video at the current hover position
    const startTimeOffset =
      this.core.mediaControl.container.getStartTimeOffset()
    const hoverTime = startTimeOffset + videoDuration * hoverPosition

    this.setText(hoverTime)

    // determine which thumbnail applies to the current time
    const thumbIndex = this._getThumbIndexForTime(hoverTime)
    const thumb = this._thumbs[thumbIndex]

    // update thumbnail
    const $spotlight = this._$spotlight

    $spotlight.empty()
    $spotlight.append(this._buildImg(thumb, this._getOptions().spotlightHeight))

    const elWidth = this.$el.width()
    const thumbWidth = $spotlight.width()
    const thumbHeight = $spotlight.height()

    let spotlightXPos = elWidth * hoverPosition - thumbWidth / 2

    // adjust so the entire thumbnail is always visible
    spotlightXPos = Math.max(Math.min(spotlightXPos, elWidth - thumbWidth), 0)

    $spotlight.css('left', spotlightXPos)

    this.$textThumbnail.css('left', spotlightXPos)
    this.$textThumbnail.css('width', thumbWidth)
    this.$textThumbnail.css('bottom', thumbHeight + 1)
  }

  // returns the thumbnail which represents a time in the video
  // or null if there is no thumbnail that can represent the time
  private _getThumbIndexForTime(time: TimeValue) {
    const thumbs = this._thumbs

    for (let i = thumbs.length - 1; i >= 0; i--) {
      const thumb = thumbs[i]

      if (thumb.time <= time) {
        return i
      }
    }

    // stretch the first thumbnail back to the start
    return 0
  }

  private _renderPlugin() {
    trace(`${T} _renderPlugin`, {
      show: this._show,
      thumbsLoaded: this._thumbsLoaded,
      thumbs: this._thumbs.length,
    })
    if (!this._thumbsLoaded) {
      return
    }
    if (this._show && this._thumbs.length > 0) {
      this.$el.removeClass('hidden')
      this._updateCarousel()
      this._updateSpotlightThumb()
    } else {
      this.$el.addClass('hidden')
    }
  }

  private _createElements() {
    trace(`${T} _createElements`)
    this.$el.html(
      Thumbnails.template({
        backdropHeight: this._getOptions().backdropHeight,
        spotlightHeight: this._getOptions().spotlightHeight,
      }),
    )
    // cache dom references
    this._$spotlight = this.$el.find('.spotlight')
    this._$backdrop = this.$el.find('.backdrop')
    this._$carousel = this._$backdrop.find('.carousel')
    this.$textThumbnail = this.$el.find('.thumbnails-text')
    this.$el.addClass('hidden')
    this._appendElToMediaControl()
  }
}
