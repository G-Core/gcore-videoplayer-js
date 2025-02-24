//Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import {
  Events,
  Playback,
  PlayerError,
  UIContainerPlugin,
  template,
  $,
  Container,
} from '@clappr/core'
import { trace } from '@gcorevideo/utils'

import { CLAPPR_VERSION } from '../../build.js'
import type { ZeptoResult } from '../../utils/types.js'

import '../../../assets/poster/poster.scss'
import posterHTML from '../../../assets/poster/poster.ejs'
import playIcon from '../../../assets/icons/new/play.svg'
import { PlaybackError } from '../../playback.types.js'

const T = 'plugins.poster_custom'

/**
 * Displays a poster image in the background and a big play button on top when playback is stopped
 * @beta
 * @remarks
 * When the playback is stopped, media control UI is disabled.
 *
 * Configuration options:
 *
 * - `poster.custom` - custom CSS background
 *
 * - `poster.showForNoOp` - whether to show the poster when the playback is not started
 *
 * - `poster.url` - the URL of the poster image
 *
 * - `poster.showOnVideoEnd` - whether to show the poster when the playback is ended
 *
 * @example
 * ```ts
 * new Player({
 *  ...
 *  poster: {
 *    showForNoOp: true,
 *    url: 'https://via.placeholder.com/150.png',
 *  }
 * })
 * ```
 */
export class Poster extends UIContainerPlugin {
  private hasFatalError = false

  private hasStartedPlaying = false

  private playRequested = false

  private $playButton: ZeptoResult | null = null

  private $playWrapper: ZeptoResult | null = null

  /**
   * @internal
   */
  get name() {
    return 'poster_custom'
  }

  /**
   * @internal
   */
  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  private static readonly template = template(posterHTML)

  private get shouldRender() {
    if (!this.enabled || this.options.reloading) {
      return false
    }
    const showForNoOp = !!this.options.poster?.showForNoOp
    return (
      this.container.playback.name !== 'html_img' &&
      (this.container.playback.getPlaybackType() !== Playback.NO_OP ||
        showForNoOp)
    )
  }

  /**
   * @internal
   */
  override get attributes() {
    return {
      class: 'player-poster',
      'data-poster': '',
    }
  }

  /**
   * @internal
   */
  override get events() {
    return {
      click: 'clicked',
    }
  }

  private get showOnVideoEnd() {
    return this.options.poster?.showOnVideoEnd !== false
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.container, Events.CONTAINER_STOP, this.onStop)
    this.listenTo(this.container, Events.CONTAINER_PLAY, this.onPlay)
    this.listenTo(this.container, Events.CONTAINER_STATE_BUFFERING, this.update)
    this.listenTo(
      this.container,
      Events.CONTAINER_STATE_BUFFERFULL,
      this.update,
    )
    this.listenTo(this.container, Events.CONTAINER_OPTIONS_CHANGE, this.render)
    this.listenTo(this.container, Events.CONTAINER_ERROR, this.onError)
    this.showOnVideoEnd &&
      this.listenTo(this.container, Events.CONTAINER_ENDED, this.onStop)
    this.listenTo(this.container, Events.CONTAINER_READY, this.render)
    this.listenTo(this.container, Events.PLAYBACK_PLAY_INTENT, this.onPlayIntent)
  }

  /**
   * Reenables earlier disabled plugin
   */
  override enable() {
    super.enable()
    this.hasStartedPlaying = this.container.playback.isPlaying()
    this.update()
  }

  /**
   * Disables the plugin, unmounting it from the DOM
   */
  override disable() {
    trace(`${T} disable`)
    this.hasStartedPlaying = false
    this.playRequested = false
    super.disable()
  }

  private onError(error: PlaybackError) {
    trace(`${T} onError`, {
      error,
      enabled: this.enabled,
    })
    this.hasFatalError = error.level === PlayerError.Levels.FATAL

    if (this.hasFatalError) {
      this.hasStartedPlaying = false
      if (!this.playRequested) {
        this.showPlayButton()
      }
    }
  }

  private onPlay() {
    trace(`${T} onPlay`)
    this.hasStartedPlaying = true
    this.playRequested = false
    this.update()
  }

  private onPlayIntent() {
    trace(`${T} onPlayIntent`)
    this.playRequested = true
    this.update()
  }

  private onStop() {
    trace(`${T} onStop`, {
      enabled: this.enabled,
    })
    this.hasStartedPlaying = false
    this.playRequested = false
    this.update()
  }

  private updatePlayButton(show: boolean) {
    trace(`${T} updatePlayButton`, {
      show,
      chromeless: this.options.chromeless,
      allowUserInteraction: this.options.allowUserInteraction,
    })
    if (
      show &&
      (!this.options.chromeless || this.options.allowUserInteraction)
    ) {
      this.showPlayButton()
    } else {
      this.hidePlayButton()
    }
  }

  private showPlayButton() {
    if (this.options.disableMediaControl) {
      return
    }
    if (this.hasFatalError && !this.options.disableErrorScreen) {
      return
    }

    this.$playButton?.show()
    this.$el.addClass('clickable')
    this.container.$el.addClass('container-with-poster-clickable')
  }

  private hidePlayButton() {
    this.$playButton.hide()
    this.$el.removeClass('clickable')
  }

  private clicked() {
    trace(`${T} clicked`, {
      hasStartedPlaying: this.hasStartedPlaying,
      chromeless: this.options.chromeless,
      allowUserInteraction: this.options.allowUserInteraction,
    })
    // Let "click_to_pause" plugin handle click event if media has started playing
    if (!this.hasStartedPlaying) {
      if (!this.options.chromeless || this.options.allowUserInteraction) {
        this.playRequested = true
        this.update()
        this.container.playback.consent()
        this.container.playback.play()
      }
    } else {
      this.container.trigger('container:start')
    }

    return false
  }

  private shouldHideOnPlay() {
    // Audio broadcasts should keep the poster up; video should hide poster while playing.
    return !this.container.playback.isAudioOnly
  }

  private update() {
    trace(`${T} update`, {
      shouldRender: this.shouldRender,
    })
    if (!this.shouldRender) {
      return
    }

    const showPlayButton =
      !this.playRequested &&
      !this.hasStartedPlaying &&
      !this.container.buffering

    this.updatePlayButton(showPlayButton)
    this.updatePoster()
  }

  private updatePoster() {
    trace(`${T} updatePoster`, {
      hasStartedPlaying: this.hasStartedPlaying,
    })
    if (!this.hasStartedPlaying) {
      this.showPoster()
    } else {
      this.hidePoster()
    }
  }

  private showPoster() {
    this.container.disableMediaControl()
    this.$el.show()
  }

  private hidePoster() {
    trace(`${T} hidePoster`, {
      shouldHideOnPlay: this.shouldHideOnPlay(),
    })
    if (!this.options.disableMediaControl) {
      this.container.enableMediaControl()
    }
    if (this.shouldHideOnPlay()) {
      this.$el.hide()
    }
  }

  /**
   * @internal
   */
  override render() {
    if (!this.shouldRender) {
      return this
    }

    this.$el.html(Poster.template())

    const isRegularPoster =
      this.options.poster && this.options.poster.custom === undefined

    if (isRegularPoster) {
      const posterUrl = this.options.poster.url || this.options.poster

      this.$el.css({ 'background-image': 'url(' + posterUrl + ')' })
    } else if (this.options.poster) {
      this.$el.css({ background: this.options.poster.custom })
    }

    this.container.$el.removeClass('container-with-poster-clickable')
    this.container.$el.append(this.el)
    this.$playWrapper = this.$el.find('.play-wrapper')
    this.$playWrapper.addClass('control-need-disable')
    this.$playButton = $(
      "<div class='circle-poster gcore-skin-button-color gcore-skin-border-color'></div>",
    )
    this.$playWrapper.append(this.$playButton)
    this.$playButton.append(playIcon)

    if (this.options.autoPlay) {
      this.$playButton.hide()
    }
    this.$playButton.addClass('poster-icon')
    this.$playButton.attr('data-poster', '')

    this.update()

    return this
  }

  /**
   * @internal
   */
  override destroy() {
    this.container.$el.removeClass('container-with-poster-clickable')
    return this
  }
}
