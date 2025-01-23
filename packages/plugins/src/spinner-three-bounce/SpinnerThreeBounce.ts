// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Container, Events, UIContainerPlugin, template } from '@clappr/core';

import spinnerHTML from '../../assets/spinner-three-bounce/spinner.ejs';
import '../../assets/spinner-three-bounce/spinner.scss';
import { TimerId } from '../types';
import { CLAPPR_VERSION } from '../build.js';

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

  constructor(container: Container) {
    super(container);
    this.listenTo(this.container, Events.CONTAINER_STATE_BUFFERING, this.onBuffering);
    this.listenTo(this.container, Events.CONTAINER_STATE_BUFFERFULL, this.onBufferFull);
    this.listenTo(this.container, Events.CONTAINER_STOP, this.onStop);
    this.listenTo(this.container, Events.CONTAINER_ENDED, this.onStop);
    this.listenTo(this.container, Events.CONTAINER_ERROR, this.onStop);
    this.listenTo(this.container, Events.CONTAINER_READY, this.render);
  }

  private onBuffering() {
    this.show();
  }

  private onBufferFull() {
    this.hide();
  }

  private onStop() {
    this.hide();
  }

  show() {
    if (this.showTimeout === null) {
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
    this.$el.html(this.template());
    this.container.$el.append(this.$el[0]);
    this.$el.hide();
    if (this.container.buffering) {
      this.onBuffering();
    }

    return this;
  }
}
