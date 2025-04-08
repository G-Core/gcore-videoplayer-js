// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found at https://github.com/clappr/clappr-plugins/blob/master/LICENSE

import { Events, Playback, UICorePlugin, Utils, template } from '@clappr/core'
import assert from 'assert'

import { TimePosition } from '../../playback.types.js'
import { CLAPPR_VERSION } from '../../build.js'

import seekTimeHTML from '../../../assets/seek-time/seek-time.html'
import '../../../assets/seek-time/seek-time.scss'

export type SeekTimeSettings = {
  duration?: boolean
}

const { formatTime } = Utils

// const T = 'plugins.seek_time'

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
    }
  }

  private get isLiveStreamWithDvr() {
    return (
      this.core.activeContainer &&
      this.core.activeContainer.getPlaybackType() === Playback.LIVE &&
      this.core.activeContainer.isDvrEnabled()
    )
  }

  private get showDuration() {
    return (
      this.core.options.seekTime?.duration === true &&
      this.core.activeContainer?.getPlaybackType() !== Playback.LIVE
    )
  }

  private hoveringOverSeekBar = false

  private hoverPosition = 0

  private displayedDuration: string | null = null

  private displayedSeekTime: string | null = null

  private duration = 0

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.onCoreReady)
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.onContainerChanged,
    )
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
    return this.isLiveStreamWithDvr
      ? this.duration - this.hoverPosition * this.duration
      : this.hoverPosition * this.duration
  }

  private update() {
    if (!this.shouldBeVisible()) {
      this.$el.hide()
      this.$el.css('left', '-100%')
      return
    }

    const seekTime = this.getSeekTime()
    let currentSeekTime = formatTime(seekTime, false)

    if (this.isLiveStreamWithDvr) {
      currentSeekTime = `-${currentSeekTime}`
    }

    // only update dom if necessary, ie time actually changed
    if (currentSeekTime !== this.displayedSeekTime) {
      this.$el.find('#mc-seek-time').text(currentSeekTime)
      this.displayedSeekTime = currentSeekTime
    }

    const $durationEl = this.$el.find('#mc-duration')
    if (this.showDuration) {
      $durationEl.show()
      const currentDuration = formatTime(this.duration, false)

      if (currentDuration !== this.displayedDuration) {
        $durationEl.text(currentDuration)
        this.displayedDuration = currentDuration
      }
    } else {
      $durationEl.hide()
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
    this.displayedDuration = null
    this.displayedSeekTime = null
    this.$el.html(SeekTime.template())
    this.$el.hide()
    return this
  }

  private mount() {
    this.core.getPlugin('media_control').$el.append(this.$el) // TODO use a method
  }
}
