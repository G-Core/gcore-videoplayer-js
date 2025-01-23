//Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { ContainerPlugin, Events, Playback } from '@clappr/core';
import { trace } from '@gcorevideo/player';

import { CLAPPR_VERSION } from '../build.js';

// const VERSION = '0.0.1';

type Timer = ReturnType<typeof setTimeout>;

const T = 'plugins.click_to_pause_custom';

export class ClickToPause extends ContainerPlugin {
  private pointerEnabled = false;

  private timer: Timer | null = null;

  get name() {
    return 'click_to_pause_custom';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  get config() {
    return this.container.options.clickToPauseConfig || {};
  }

  override bindEvents() {
    this.listenTo(this.container, Events.CONTAINER_CLICK, this.click);
    this.listenTo(this.container, Events.CONTAINER_SETTINGSUPDATE, this.settingsUpdate);
  }

  private click() {
    const isLivePlayback = this.container.getPlaybackType() === Playback.LIVE;
    const isDvrEnabled = this.container.isDvrEnabled();

    trace(`${T} click`, {
      isLivePlayback,
      isDvrEnabled,
    });

    if (isLivePlayback && !isDvrEnabled) {
      this.togglePlay(true);
    } else if (!isLivePlayback || isDvrEnabled) {
      this.clearTimer();
      this.timer = setTimeout(() => {
        this.timer = null
        this.togglePlay(false);
      }, 300);
    }
  }

  private settingsUpdate() {
    const isLivePlayback = this.container.getPlaybackType() === Playback.LIVE;
    const pointerEnabled = !isLivePlayback || this.container.isDvrEnabled();

    trace(`${T} settingsUpdate`, {
      isLivePlayback,
      pointerEnabled,
    })

    if (pointerEnabled === this.pointerEnabled) {
      return;
    }

    const method = pointerEnabled ? 'addClass' : 'removeClass';

    this.container.$el[method]('pointer-enabled');
    this.pointerEnabled = pointerEnabled;
  }

  private togglePlay(useStop: boolean) {
    const isPlaying = this.container && this.container.isPlaying();

    if (isPlaying) {
      useStop ? this.container.stop() : this.container.pause();
    } else {
      this.container.play();
    }
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
