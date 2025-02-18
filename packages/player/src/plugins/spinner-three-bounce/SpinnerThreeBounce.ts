// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Container, Events, UIContainerPlugin, template } from '@clappr/core';
import { PlaybackError, PlaybackErrorCode } from '../../playback.types.js';
import { trace } from '@gcorevideo/utils';

import spinnerHTML from '../../../assets/spinner-three-bounce/spinner.ejs';
import '../../../assets/spinner-three-bounce/spinner.scss';
import { TimerId } from '../../utils/types.js';
import { CLAPPR_VERSION } from '../build.js';

const T = 'plugins.spinner'

export class SpinnerThreeBounce extends UIContainerPlugin {
  get name() {
    return 'spinner';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  override get attributes() {
    return {
      'data-spinner':'',
      'class': 'spinner-three-bounce'
    };
  }

  private showTimeout: TimerId | null = null;

  private template = template(spinnerHTML);

  private hasFatalError = false

  private hasBuffering = false

  constructor(container: Container) {
    super(container);
    this.listenTo(this.container, Events.CONTAINER_STATE_BUFFERING, this.onBuffering);
    this.listenTo(this.container, Events.CONTAINER_STATE_BUFFERFULL, this.onBufferFull);
    this.listenTo(this.container, Events.CONTAINER_PLAY, this.onPlay);
    this.listenTo(this.container, Events.CONTAINER_STOP, this.onStop);
    this.listenTo(this.container, Events.CONTAINER_ENDED, this.onStop);
    this.listenTo(this.container, Events.CONTAINER_ERROR, this.onError);
    this.listenTo(this.container, Events.CONTAINER_READY, this.render);
  }

  private onBuffering() {
    this.hasBuffering = true
    this.show();
  }

  private onBufferFull() {
    if (!this.hasFatalError && this.hasBuffering) {
      this.hide();
    }
    this.hasBuffering = false
  }

  private onPlay() {
    trace(`${T} onPlay`);
    this.hide();
  }

  private onStop() {
    trace(`${T} onStop`, {
      showOnError: this.options.spinner?.showOnError,
      hasFatalError: this.hasFatalError,
    })
    if (!(this.hasFatalError && this.options.spinner?.showOnError)) {
      this.hide();
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
      this.show();
    } else {
      this.hide();
    }
  }

  show(immediate = false) {
    trace(`${T} show`, {
      immediate,
    })
    if (immediate) {
      if (this.showTimeout !== null) {
        clearTimeout(this.showTimeout);
        this.showTimeout = null;
      }
      this.$el.show();
    } else if (this.showTimeout === null) {
      this.showTimeout = setTimeout(() => this.$el.show(), 300);
    }
  }

  hide() {
    if (this.showTimeout !== null) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
    this.$el.hide();
  }

  override render() {
    const showOnStart = this.options.spinner?.showOnStart;
    trace(`${T} render`, {
      buffering: this.container.buffering,
      showOnStart,
    })
    this.$el.html(this.template());
    this.el.firstElementChild?.addEventListener('animationiteration', () => {
      this.trigger('spinner:sync')
    })
    this.container.$el.append(this.$el[0]);
    if (showOnStart || this.container.buffering) {
      this.show();
    } else {
      this.hide();
    }

    return this;
  }
}
