import { UICorePlugin, Events, Browser, $, Container } from '@clappr/core';
import { reportError } from '@gcorevideo/player';

import { TimerId } from '../types';

export enum VolumeFadeEvents {
  FADE = 'core:volume:fade',
}

export class VolumeFade extends UICorePlugin {
  private _aboveBorderVolume = 0;

  private container: Container | null = null;

  private delay = 0;

  private interval: TimerId | null = null;

  get name() {
    return 'volume_fade';
  }

  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.onCoreReady);
    if (this.core.mediaControl) {
      this.listenTo(this.core.mediaControl, 'mediacontrol:volume:user', this._onUserChangeVolume);
    }
    this.listenTo(this.core, 'core:volume:config', this._onVolumeConfig);
  }

  unBindEvents() {
    this.core.$el.off('mouseleave.volume');
    this.core.$el.off('mouseenter.volume');
  }

  private _onUserChangeVolume(volume: number) {
    this._aboveBorderVolume = volume;
  }

  private _onVolumeConfig(value: number) {
    this._aboveBorderVolume = value;
    this.container?.setVolume(0);
  }

  private onCoreReady() {
    this.unBindEvents();
    this.container = this.core.activeContainer;
    if (this.core && this.core.$el) {
      // TODO find out why options.playerElement instead of this.core.$el or this.container.$el
      $(this.options.playerElement).on('mouseenter.volume', () => {
        this.onEnter();
      });
      $(this.options.playerElement).on('mouseleave.volume', () => {
        this.onLeave();
      });
    }
    if (!this._aboveBorderVolume) {
      this._aboveBorderVolume = this.container?.volume && !isNaN(this.container.volume) ? this.container.volume : 80;
    }
    if (this.options.mute || Browser.isMobile) {
      this.destroy();

      return;
    }
    this.delay = this.options.volumeFade && this.options.volumeFade.delay || 600;
    this.container?.setVolume(0);
  }

  private onEnter() {
    this.numberTo(this.delay);
  }

  private numberTo(duration: number, contra = 0) {
    this.clearCurrentInterval();
    const start = new Date().getTime();

    this.interval = setInterval(() => {
      let now = (new Date().getTime()) - start;

      if (now > duration) {
        now = duration;
      }
      const progress = Math.abs(contra - now / duration);

      try {
        this.container?.setVolume(progress * this._aboveBorderVolume);
        this.core.trigger(VolumeFadeEvents.FADE, progress * this._aboveBorderVolume);
      } catch (error) {
        // LogManager.exception(error);
        reportError(error);
        this.clearCurrentInterval();
      }
      if (progress >= 1 || progress <= 0) {
        this.clearCurrentInterval();
      }
    }, 10);
  }

  private clearCurrentInterval() {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private onLeave() {
    this.numberTo(this.delay, 1);
  }
}
