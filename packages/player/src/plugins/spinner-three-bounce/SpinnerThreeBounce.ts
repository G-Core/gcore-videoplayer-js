// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import {
  Container,
  Events as ClapprEvents,
  UIContainerPlugin,
  template,
} from '@clappr/core'
import { trace } from '@gcorevideo/utils'

import { PlaybackError, PlaybackErrorCode } from '../../playback.types.js'
import spinnerHTML from '../../../assets/spinner-three-bounce/spinner.ejs'
import '../../../assets/spinner-three-bounce/spinner.scss'
import { TimerId } from '../../utils/types.js'
import { CLAPPR_VERSION } from '../../build.js'

const T = 'plugins.spinner'

/**
 * Custom events emitted by the plugin
 * @beta
 */
export enum SpinnerEvents {
  /**
   * Emitted at the end of the spinner animation cycle to facilitate smooth UI updates,
   * e.g. {@link SourceController} listens to this event to reload the source when the spinner is hidden
   */
  SYNC = 'plugins:spinner:sync',
}

/**
 * `PLUGIN` that shows a pending operation indicator when playback is buffering or in a similar state
 * @beta
 * @remarks
 * Events emitted- {@link SpinnerEvents}
 * Other plugins can use {@link SpinnerThreeBounce.show | show} and {@link SpinnerThreeBounce.hide | hide} methods to
 * implement custom pending/progress indication scenarios.
 */
export class SpinnerThreeBounce extends UIContainerPlugin {
  private userShown = false

  /**
   * @internal
   */
  get name() {
    return 'spinner'
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
      'data-spinner': '',
      class: 'spinner-three-bounce',
    }
  }

  private showTimeout: TimerId | null = null

  private template = template(spinnerHTML)

  private hasFatalError = false

  private hasBuffering = false

  constructor(container: Container) {
    super(container)
    this.listenTo(
      this.container,
      ClapprEvents.CONTAINER_STATE_BUFFERING,
      this.onBuffering,
    )
    this.listenTo(
      this.container,
      ClapprEvents.CONTAINER_STATE_BUFFERFULL,
      this.onBufferFull,
    )
    this.listenTo(this.container, ClapprEvents.CONTAINER_PLAY, this.onPlay)
    this.listenTo(this.container, ClapprEvents.CONTAINER_STOP, this.onStop)
    this.listenTo(this.container, ClapprEvents.CONTAINER_ENDED, this.onStop)
    this.listenTo(this.container, ClapprEvents.CONTAINER_ERROR, this.onError)
    this.listenTo(this.container, ClapprEvents.CONTAINER_READY, this.render)
  }

  private onBuffering() {
    this.hasBuffering = true
    this._show()
  }

  private onBufferFull() {
    if (!this.hasFatalError && this.hasBuffering) {
      this._hide()
    }
    this.hasBuffering = false
  }

  private onPlay() {
    trace(`${T} onPlay`)
    this._hide()
  }

  private onStop() {
    trace(`${T} onStop`, {
      showOnError: this.options.spinner?.showOnError,
      hasFatalError: this.hasFatalError,
    })
    if (!(this.hasFatalError && this.options.spinner?.showOnError)) {
      this._hide()
    }
  }

  private onError(e: PlaybackError) {
    this.hasFatalError = e.code === PlaybackErrorCode.MediaSourceUnavailable
    trace(`${T} onError`, {
      e,
      showOnError: this.options.spinner?.showOnError,
      hasFatalError: this.hasFatalError,
      error: e.code,
    })
    if (this.options.spinner?.showOnError) {
      this._show()
    } else {
      this._hide()
    }
  }

  /**
   * Shows the spinner.
   *
   * When called, the spinner will not hide (due to its built-in logic) until {@link SpinnerThreeBounce.hide} is called
   */
  show(delay = 300) {
    trace(`${T} show`)
    this.userShown = true
    this._show(delay)
  }

  /**
   * Hides the spinner.
   */
  hide() {
    this.userShown = false
    this._hide()
  }

  private _show(delay = 300) {
    if (this.showTimeout === null) {
      this.showTimeout = setTimeout(() => {
        this.showTimeout = null
        this.$el.show()
      }, delay)
    }
  }

  private _hide() {
    trace(`${T} _hide`, {
      userShown: this.userShown,
    })
    if (this.userShown) {
      return
    }
    if (this.showTimeout !== null) {
      clearTimeout(this.showTimeout)
      this.showTimeout = null
    }
    this.$el.hide()
    this.trigger(SpinnerEvents.SYNC) // TODO test
  }

  /**
   * @internal
   */
  override render() {
    const showOnStart = this.options.spinner?.showOnStart
    trace(`${T} render`, {
      buffering: this.container.buffering,
      showOnStart,
    })
    this.$el.html(this.template())
    this.el.firstElementChild?.addEventListener('animationiteration', () => {
      this.trigger(SpinnerEvents.SYNC)
    })
    this.container.$el.append(this.$el[0])
    if (showOnStart || this.container.buffering) {
      this._show()
    } else {
      this._hide()
    }

    return this
  }
}
