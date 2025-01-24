//Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Events, Playback, PlayerError, UIContainerPlugin, template, $, Container } from '@clappr/core';
import { trace } from '@gcorevideo/player';

import { CLAPPR_VERSION } from '../build.js';
import type { ZeptoResult } from '../types.js';

import '../../assets/poster/poster.scss';
import posterHTML from '../../assets/poster/poster.ejs';
import playIcon from '../../assets/icons/new/play.svg';

const T = 'plugins.poster_custom';

export class Poster extends UIContainerPlugin {
  private hasFatalError = false;

  private hasStartedPlaying = false;

  private playRequested = false;

  private $playButton: ZeptoResult | null = null;

  private $playWrapper: ZeptoResult | null = null;

  get name() {
    return 'poster_custom';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  get template() {
    return template(posterHTML);
  }

  get shouldRender() {
    const showForNoOp = !!(this.options.poster && this.options.poster.showForNoOp);
    return this.container.playback.name !== 'html_img' && (this.container.playback.getPlaybackType() !== Playback.NO_OP || showForNoOp);
  }

  override get attributes() {
    return {
      'class': 'player-poster',
      'data-poster': ''
    };
  }

  override get events() {
    return {
      'click': 'clicked'
    };
  }

  get showOnVideoEnd() {
    return !this.options.poster || this.options.poster.showOnVideoEnd || this.options.poster.showOnVideoEnd === undefined;
  }

  constructor(container: Container) {
    super(container);
    
    this.render();
    setTimeout(() => this.update(), 0);
  }

  override bindEvents() {
    this.listenTo(this.container, Events.CONTAINER_STOP, this.onStop);
    this.listenTo(this.container, Events.CONTAINER_PLAY, this.onPlay);
    this.listenTo(this.container, Events.CONTAINER_STATE_BUFFERING, this.update);
    this.listenTo(this.container, Events.CONTAINER_STATE_BUFFERFULL, this.update);
    this.listenTo(this.container, Events.CONTAINER_OPTIONS_CHANGE, this.render);
    this.listenTo(this.container, Events.CONTAINER_ERROR, this.onError);
    this.showOnVideoEnd && this.listenTo(this.container, Events.CONTAINER_ENDED, this.onStop);
    this.listenTo(this.container, Events.CONTAINER_READY, this.render);
  }

  private onError(error: object) { // TODO add type
    trace(`${T} onError`, {
      error,
    })
    // @ts-ignore
    this.hasFatalError = error.level === PlayerError.Levels.FATAL;

    if (this.hasFatalError) {
      this.hasStartedPlaying = false;
      this.playRequested = !!this.options.autoPlay;
      if (!this.playRequested) {
        this.showPlayButton();
      }
    }
  }

  private onPlay() {
    this.hasStartedPlaying = true;
    this.update();
  }

  private onStop() {
    this.hasStartedPlaying = false;
    this.playRequested = false;
    this.update();
  }

  private updatePlayButton(show: boolean) {
    if (show && (!this.options.chromeless || this.options.allowUserInteraction)) {
      this.showPlayButton();
    } else {
      this.hidePlayButton();
    }
  }

  private showPlayButton() {
    if (this.options.disableMediaControl) {
      return;
    }
    if (this.hasFatalError && !this.options.disableErrorScreen) {
      return;
    }

    this.$playButton?.show();
    this.$el.addClass('clickable');
    this.container.$el.addClass('container-with-poster-clickable');
  }

  private hidePlayButton() {
    this.$playButton.hide();
    this.$el.removeClass('clickable');
  }

  private clicked() {
    // Let "click_to_pause" plugin handle click event if media has started playing
    if (!this.hasStartedPlaying) {
      if (!this.options.chromeless || this.options.allowUserInteraction) {
        this.playRequested = true;
        this.update();
        this.container.playback && (this.container.playback._consented = true);
        this.container.play();
      }
    } else {
      this.container.trigger('container:start');
    }

    return false;
  }

  private shouldHideOnPlay() {
    // Audio broadcasts should keep the poster up; video should hide poster while playing.
    return !this.container.playback.isAudioOnly;
  }

  private update() {
    if (!this.shouldRender) {
      return;
    }

    const showPlayButton = !this.playRequested && !this.hasStartedPlaying && !this.container.buffering;

    this.updatePlayButton(showPlayButton);
    this.updatePoster();
  }

  private updatePoster() {
    if (!this.hasStartedPlaying) {
      this.showPoster();
    } else {
      this.hidePoster();
    }
  }

  private showPoster() {
    this.container.disableMediaControl();
    this.$el.show();
  }

  private hidePoster() {
    if (!this.options.disableMediaControl) {
      this.container.enableMediaControl();
    }
    if (this.shouldHideOnPlay()) {
      this.$el.hide();
    }
  }

  override render() {
    if (!this.shouldRender) {
      return this;
    }

    this.$el.html(this.template());

    const isRegularPoster = this.options.poster && this.options.poster.custom === undefined;

    if (isRegularPoster) {
      const posterUrl = this.options.poster.url || this.options.poster;

      this.$el.css({ 'background-image': 'url(' + posterUrl + ')' });
    } else if (this.options.poster) {
      this.$el.css({ 'background': this.options.poster.custom });
    }

    this.container.$el.removeClass('container-with-poster-clickable');
    this.container.$el.append(this.el);
    this.$playWrapper = this.$el.find('.play-wrapper');
    this.$playWrapper.addClass('control-need-disable');
    this.$playButton = $('<div class=\'circle-poster gcore-skin-button-color gcore-skin-border-color\'></div>');
    this.$playWrapper.append(this.$playButton);
    this.$playButton.append(playIcon);

    if (this.options.autoPlay) {
      this.$playButton.hide();
    }
    this.$playButton.addClass('poster-icon');
    this.$playButton.attr('data-poster', '');

    this.update();

    return this;
  }

  // private removeVideoElementPoster() {
  //   this.container.playback &&
  //   this.container.playback.$el &&
  //   this.container.playback.$el[0] &&
  //   this.container.playback.$el[0].removeAttribute &&
  //   this.container.playback.$el[0].removeAttribute('poster');
  // }

  override destroy() {
    this.container.$el.removeClass('container-with-poster-clickable');
    return this;
  }
}
