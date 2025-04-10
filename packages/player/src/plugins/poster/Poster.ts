//Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import {
  Events,
  Playback,
  PlayerError,
  UIContainerPlugin,
  template,
} from '@clappr/core'
import { trace } from '@gcorevideo/utils'

import { CLAPPR_VERSION } from '../../build.js'
import type { ZeptoResult } from '../../types.js'

import '../../../assets/poster/poster.scss'
import posterHTML from '../../../assets/poster/poster.ejs'
import playIcon from '../../../assets/icons/new/play.svg'
import { PlaybackError } from '../../playback.types.js'

export type PosterPluginSettings = {
  /**
   * Custom CSS background
   */
  custom?: string
  /**
   * Whether to show the poster image when the playback is noop (i.e., when there is no appropriate video playback engine for current media sources set or the media sources are not set at all)
   */
  showForNoOp?: boolean
  /**
   * Poster image URL
   */
  url?: string
  /**
   * Whether to show the poster after playback has ended @default true
   */
  showOnVideoEnd?: boolean
}

const T = 'plugins.poster'

/**
 * `PLUGIN` that displays a poster image in the background and a big play button on top when playback is stopped
 * @beta
 * @remarks
 * When the playback is stopped or not yet started, the media control UI is disabled and hidden.
 * Media control gets activated once the metadata is loaded after playback is initiated.
 * This plugin displays a big play button on top of the poster image to allow user to start playback.
 * Note that the poster image, if specified via the player config, will be used to update video element's poster attribute by the
 * HTML5-video-based playback module.
 *
 * Configuration options - {@link PosterPluginSettings}
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
  // TODO merge non-poster related functionality into the ClickToPause plugin

  private hasFatalError = false

  private playing = false

  private playRequested = false

  private $playButton: ZeptoResult | null = null

  /**
   * @internal
   */
  get name() {
    return 'poster'
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
      (!this.isNoOp || showForNoOp)
    )
  }

  private get isNoOp() {
    return this.container.playback.getPlaybackType() === Playback.NO_OP
  }

  /**
   * @internal
   */
  override get attributes() {
    return {
      class: 'player-poster',
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
    this.listenTo(this.container, Events.CONTAINER_OPTIONS_CHANGE, this.update)
    this.listenTo(this.container, Events.CONTAINER_ERROR, this.onError)
    // TODO check if this event is always accompanied with the CONTAINER_STOP
    if (this.options.poster?.showOnVideoEnd !== false) {
      this.listenTo(this.container, Events.CONTAINER_ENDED, this.onStop)
    }
    this.listenTo(this.container, Events.CONTAINER_READY, this.render)
    this.listenTo(
      this.container.playback,
      Events.PLAYBACK_PLAY_INTENT,
      this.onPlayIntent,
    )
  }

  /**
   * Reenables earlier disabled plugin
   */
  override enable() {
    trace(`${T} enable`)
    super.enable()
    this.playing = this.container.playback.isPlaying()
    this.update()
  }

  /**
   * Disables the plugin, unmounting it from the DOM
   */
  override disable() {
    trace(`${T} disable`)
    this.playing = false
    this.playRequested = false
    super.disable()
  }

  private onError(error: PlaybackError) {
    trace(`${T} onError`, {
      error,
      enabled: this.enabled,
    })
    if (this.hasFatalError) {
      return
    }
    this.hasFatalError = error.level === PlayerError.Levels.FATAL
    // this.hasFatalError is reset on container recreate
  }

  private onPlay() {
    trace(`${T} onPlay`)
    this.playing = true
    this.playRequested = false
    this.update()
  }

  private onPlayIntent() {
    trace(`${T} onPlayIntent`)
    this.playRequested = true
    this.update()
  }

  private onStop() {
    trace(`${T} onStop`)
    this.playing = false
    this.playRequested = false
    this.update()
  }

  private updatePlayButton() {
    trace(`${T} updatePlayButton`)
    const show =
      !this.isNoOp &&
      !(this.options.chromeless && !this.options.allowUserInteraction) &&
      !this.playRequested &&
      !this.playing &&
      !this.container.buffering &&
      !this.hasFatalError &&
      !this.options.disableMediaControl
    if (show) {
      this.showPlayButton()
    } else {
      this.hidePlayButton()
    }
  }

  private showPlayButton() {
    trace(`${T} showPlayButton`)
    this.$el.find('#poster-play').show()
    this.$el.addClass('clickable')
    this.container.$el.addClass('container-with-poster-clickable')
  }

  private hidePlayButton() {
    trace(`${T} hidePlayButton`)
    this.$el.find('#poster-play').hide()
    this.$el.removeClass('clickable')
  }

  private clicked(e: MouseEvent) {
    trace(`${T} clicked`)
    e.preventDefault()
    e.stopPropagation()
    if (this.options.chromeless && !this.options.allowUserInteraction) {
      return
    }
    // Let "click_to_pause" plugin handle click event if media has started playing
    if (!this.playing) {
      this.playRequested = true
      this.update()
      this.container.play()
    }
  }

  private shouldHideOnPlay() {
    // Audio broadcasts should keep the poster up; video should hide poster while playing.
    return !this.container.playback.isAudioOnly
  }

  private update() {
    trace(`${T} update`)

    this.updatePlayButton()
    this.updatePoster()
  }

  private updatePoster() {
    trace(`${T} updatePoster`)
    if (!this.playing) {
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
    trace(`${T} hidePoster`)
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

    const isCustomPoster = this.options.poster?.custom !== undefined

    if (isCustomPoster) {
      this.$el.css({ background: this.options.poster.custom })
    } else {
      const posterUrl =
        typeof this.options.poster === 'string'
          ? this.options.poster
          : this.options.poster?.url
      if (posterUrl) {
        this.$el.css({ 'background-image': 'url(' + posterUrl + ')' })
      }
    }

    this.container.$el.removeClass('container-with-poster-clickable')
    this.container.$el.append(this.el)
    this.$el.find('#poster-play').append(playIcon)

    if (this.options.autoPlay || this.isNoOp) {
      this.$el.find('#poster-play').hide()
    }

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
