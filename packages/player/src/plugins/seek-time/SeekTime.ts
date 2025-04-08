// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found at https://github.com/clappr/clappr-plugins/blob/master/LICENSE

import { Events, Playback, UICorePlugin, Utils, template } from '@clappr/core'
import { TimePosition } from '../../playback.types.js'

import { CLAPPR_VERSION } from '../../build.js'

import seekTimeHTML from '../../../assets/seek-time/seek-time.html'
import '../../../assets/seek-time/seek-time.scss'
import { ZeptoResult } from '../../types.js'
import assert from 'assert'

const { formatTime } = Utils

/**
 * `PLUGIN` that adds a seek time indicator to the media control UI.
 * @beta
 */
export class SeekTime extends UICorePlugin {
  get name() {
    return 'seek_time'
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  private static readonly template = template(seekTimeHTML)

  override get attributes() {
    return {
      class: 'seek-time',
      'data-seek-time': '',
    }
  }

  private get isLiveStreamWithDvr() {
    return (
      this.core.activeContainer &&
      this.core.activeContainer.getPlaybackType() === Playback.LIVE &&
      this.core.activeContainer.isDvrEnabled()
    )
  }

  private get durationShown() {
    return !this.isLiveStreamWithDvr
  }

  private hoveringOverSeekBar = false

  private hoverPosition = 0

  private displayedDuration: string | null = null

  private displayedSeekTime: string | null = null

  private duration = 0
  // private firstFragDateTime = 0;

  private rendered = false

  private $durationEl: ZeptoResult | null = null

  private $seekTimeEl: ZeptoResult | null = null

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.onCoreReady)
  }

  private onCoreReady() {
    const mediaControl = this.core.getPlugin('media_control')
    assert(
      mediaControl,
      'MediaControl plugin is required for SeekTime plugin to work',
    )
    this.listenTo(mediaControl, Events.MEDIACONTROL_RENDERED, this.mount)
    this.listenTo(
      mediaControl,
      Events.MEDIACONTROL_MOUSEMOVE_SEEKBAR,
      this.showTime,
    )
    this.listenTo(
      mediaControl,
      Events.MEDIACONTROL_MOUSELEAVE_SEEKBAR,
      this.hideTime,
    )
    this.listenTo(
      mediaControl,
      Events.MEDIACONTROL_CONTAINERCHANGED,
      this.onContainerChanged,
    )
    if (this.core.activeContainer) {
      this.listenTo(
        this.core.activeContainer,
        Events.CONTAINER_PLAYBACKDVRSTATECHANGED,
        this.update,
      )
      this.listenTo(
        this.core.activeContainer,
        Events.CONTAINER_TIMEUPDATE,
        this.onTimeUpdate,
      )
    }
  }

  private onContainerChanged() {
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_PLAYBACKDVRSTATECHANGED,
      this.update,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_TIMEUPDATE,
      this.onTimeUpdate,
    )
  }

  private onTimeUpdate({ total }: TimePosition) {
    this.duration = total
    this.update()
  }

  private showTime(event: MouseEvent) {
    this.hoveringOverSeekBar = true
    this.calculateHoverPosition(event)
    this.update()
  }

  private hideTime() {
    this.hoveringOverSeekBar = false
    this.update()
  }

  private calculateHoverPosition(event: MouseEvent) {
    const mediaControl = this.core.getPlugin('media_control')
    const offset = event.pageX - mediaControl.$seekBarContainer.offset().left

    // proportion into the seek bar that the mouse is hovered over 0-1
    this.hoverPosition = Math.min(
      1,
      Math.max(offset / mediaControl.$seekBarContainer.width(), 0),
    )
  }

  private getSeekTime() {
    const seekTime = this.isLiveStreamWithDvr
      ? this.duration - this.hoverPosition * this.duration
      : this.hoverPosition * this.duration

    return { seekTime }
  }

  private update() {
    if (!this.rendered) {
      // update() is always called after a render
      return
    }
    if (!this.shouldBeVisible()) {
      this.$el.hide()
      this.$el.css('left', '-100%')
      return
    }

    const seekTime = this.getSeekTime()
    let currentSeekTime = formatTime(seekTime.seekTime, false)

    if (this.isLiveStreamWithDvr) {
      currentSeekTime = `-${currentSeekTime}`
    }

    // only update dom if necessary, ie time actually changed
    if (currentSeekTime !== this.displayedSeekTime) {
      this.$seekTimeEl.text(currentSeekTime)
      this.displayedSeekTime = currentSeekTime
    }

    if (this.durationShown) {
      this.$durationEl.show()
      const currentDuration = formatTime(this.duration, false)

      if (currentDuration !== this.displayedDuration) {
        this.$durationEl.text(currentDuration)
        this.displayedDuration = currentDuration
      }
    } else {
      this.$durationEl.hide()
    }

    // the element must be unhidden before its width is requested, otherwise it's width will be reported as 0
    this.$el.show()
    const mediaControl = this.core.getPlugin('media_control')
    const containerWidth = mediaControl.$seekBarContainer.width()
    const elWidth = this.$el.width()
    let elLeftPos = this.hoverPosition * containerWidth

    elLeftPos -= elWidth / 2
    elLeftPos = Math.max(0, Math.min(elLeftPos, containerWidth - elWidth))
    this.$el.css('left', elLeftPos)
  }

  private shouldBeVisible() {
    return (
      this.core.activeContainer &&
      this.core.activeContainer.settings.seekEnabled &&
      this.hoveringOverSeekBar &&
      this.hoverPosition !== null &&
      this.duration !== null
    )
  }

  /**
   * @internal
   */
  override render() {
    this.rendered = true
    this.displayedDuration = null
    this.displayedSeekTime = null
    this.$el.html(SeekTime.template())
    this.$el.hide()
    // this.mediaControl.$el.append(this.el);
    this.$seekTimeEl = this.$el.find('#mc-seek-time')
    this.$durationEl = this.$el.find('#mc-duration')
    this.$durationEl.hide()
    this.update()
    return this
  }

  private mount() {
    this.core.getPlugin('media_control').$el.append(this.$el) // TODO use a method
  }
}
