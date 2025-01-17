// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Events, Playback, UICorePlugin, Utils, template } from '@clappr/core';
import { TimeUpdate } from '@gcorevideo/player';

import { CLAPPR_VERSION } from '../build.js';

import seekTimeHTML from '../../assets/seek-time/seek-time.html';
import '../../assets/seek-time/seek-time.scss';
import { ZeptoResult } from '../types.js';

const { formatTime } = Utils;

export class SeekTime extends UICorePlugin {
  get name() {
    return 'seek_time';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  get template() {
    return template(seekTimeHTML);
  }

  get attributes() {
    return {
      'class': 'seek-time',
      'data-seek-time': ''
    };
  }

  get mediaControl() {
    return this.core.mediaControl;
  }

  get mediaControlContainer() {
    return this.mediaControl.container;
  }

  get isLiveStreamWithDvr() {
    return this.mediaControlContainer &&
      this.mediaControlContainer.getPlaybackType() === Playback.LIVE &&
      this.mediaControlContainer.isDvrEnabled();
  }

  get durationShown() {
    return !this.isLiveStreamWithDvr;
  }

  private hoveringOverSeekBar = false;

  private hoverPosition = 0;

  private displayedDuration: string | null = null;

  private displayedSeekTime: string| null = null;

  private duration = 0;
  // private firstFragDateTime = 0;

  private rendered = false;

  private $durationEl: ZeptoResult | null = null;

  private $seekTimeEl: ZeptoResult | null = null;

  bindEvents() {
    this.listenTo(this.mediaControl, Events.MEDIACONTROL_RENDERED, this.render);
    this.listenTo(this.mediaControl, Events.MEDIACONTROL_MOUSEMOVE_SEEKBAR, this.showTime);
    this.listenTo(this.mediaControl, Events.MEDIACONTROL_MOUSELEAVE_SEEKBAR, this.hideTime);
    this.listenTo(this.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.onContainerChanged);
    if (this.mediaControlContainer) {
      this.listenTo(this.mediaControlContainer, Events.CONTAINER_PLAYBACKDVRSTATECHANGED, this.update);
      this.listenTo(this.mediaControlContainer, Events.CONTAINER_TIMEUPDATE, this.updateDuration);
    }
  }

  private onContainerChanged() {
    // @ts-ignore
    this.stopListening();
    this.bindEvents();
  }

  private updateDuration(timeProgress: TimeUpdate) {
    this.duration = timeProgress.total;
    // this.firstFragDateTime = timeProgress.firstFragDateTime;
    this.update();
  }

  private showTime(event: MouseEvent) {
    this.hoveringOverSeekBar = true;
    this.calculateHoverPosition(event);
    this.update();
  }

  private hideTime() {
    this.hoveringOverSeekBar = false;
    this.update();
  }

  private calculateHoverPosition(event: MouseEvent) {
    const offset = event.pageX - this.mediaControl.$seekBarContainer.offset().left;

    // proportion into the seek bar that the mouse is hovered over 0-1
    this.hoverPosition = Math.min(1, Math.max(offset/this.mediaControl.$seekBarContainer.width(), 0));
  }

  getSeekTime() {
    let seekTime;

    if (this.isLiveStreamWithDvr) {
      seekTime = this.duration - this.hoverPosition * this.duration;
    } else {
      seekTime = this.hoverPosition * this.duration;
    }

    return { seekTime };
  }

  update() {
    if (!this.rendered) {
      // update() is always called after a render
      return;
    }
    if (!this.shouldBeVisible()) {
      this.$el.hide();
      this.$el.css('left', '-100%');
    } else {
      const seekTime = this.getSeekTime();
      let currentSeekTime = formatTime(seekTime.seekTime, false);

      if (this.isLiveStreamWithDvr) {
        currentSeekTime = `-${currentSeekTime}`;
      }

      // only update dom if necessary, ie time actually changed
      if (currentSeekTime !== this.displayedSeekTime) {
        this.$seekTimeEl.text(currentSeekTime);
        this.displayedSeekTime = currentSeekTime;
      }

      if (this.durationShown) {
        this.$durationEl.show();
        const currentDuration = formatTime(this.duration, false);

        if (currentDuration !== this.displayedDuration) {
          this.$durationEl.text(currentDuration);
          this.displayedDuration = currentDuration;
        }
      } else {
        this.$durationEl.hide();
      }

      // the element must be unhidden before its width is requested, otherwise it's width will be reported as 0
      this.$el.show();
      const containerWidth = this.mediaControl.$seekBarContainer.width();
      const elWidth = this.$el.width();
      let elLeftPos = this.hoverPosition * containerWidth;

      elLeftPos -= elWidth / 2;
      elLeftPos = Math.max(0, Math.min(elLeftPos, containerWidth - elWidth));
      this.$el.css('left', elLeftPos);
    }
  }

  shouldBeVisible() {
    return this.mediaControlContainer &&
      this.mediaControlContainer.settings.seekEnabled &&
      this.hoveringOverSeekBar &&
      this.hoverPosition !== null &&
      this.duration !== null;
  }

  render() {
    this.rendered = true;
    this.displayedDuration = null;
    this.displayedSeekTime = null;
    this.$el.html(this.template());
    this.$el.hide();
    this.mediaControl.$el.append(this.el);
    this.$seekTimeEl = this.$el.find('[data-seek-time]');
    this.$durationEl = this.$el.find('[data-duration]');
    this.$durationEl.hide();
    this.update();
    return this;
  }
}
