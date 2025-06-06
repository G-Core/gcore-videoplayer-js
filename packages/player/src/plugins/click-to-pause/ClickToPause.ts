// This work is based on the original work of the following authors:
// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found at https://github.com/clappr/clappr-plugins/blob/master/LICENSE.

import { ContainerPlugin, Events, Playback } from '@clappr/core'
// import { trace } from '@gcorevideo/utils'

import { CLAPPR_VERSION } from '../../build.js'

type Timer = ReturnType<typeof setTimeout>

// const T = 'plugins.click_to_pause'

/**
 * A small `PLUGIN` that toggles the playback state on click over the video container
 * @public
 */
export class ClickToPause extends ContainerPlugin {
  private pointerEnabled = false

  private timer: Timer | null = null

  /**
   * @internal
   */
  get name() {
    return 'click_to_pause'
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
  override bindEvents() {
    this.listenTo(this.container, Events.CONTAINER_CLICK, this.click)
    this.listenTo(
      this.container,
      Events.CONTAINER_SETTINGSUPDATE,
      this.settingsUpdate,
    )
  }

  private click() {
    const isLivePlayback = this.container.getPlaybackType() === Playback.LIVE
    const isDvrEnabled = this.container.isDvrEnabled()

    if (isLivePlayback && !isDvrEnabled) {
      this.togglePlay(true)
      return
    }
    this.clearTimer()
    this.timer = setTimeout(() => {
      this.timer = null
      this.togglePlay(false)
    }, 300)
  }

  private settingsUpdate() {
    const isLivePlayback = this.container.getPlaybackType() === Playback.LIVE
    const pointerEnabled = !isLivePlayback || this.container.isDvrEnabled()

    if (pointerEnabled === this.pointerEnabled) {
      return
    }

    const method = pointerEnabled ? 'addClass' : 'removeClass'

    this.container.$el[method]('pointer-enabled')
    this.pointerEnabled = pointerEnabled
  }

  private togglePlay(useStop: boolean) {
    const isPlaying = this.container && this.container.isPlaying()

    if (isPlaying) {
      useStop ? this.container.stop({ ui: true }) : this.container.pause()
    } else {
      this.container.play()
    }
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
