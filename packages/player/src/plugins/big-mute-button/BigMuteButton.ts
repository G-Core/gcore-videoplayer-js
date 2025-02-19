import { Events, template, UICorePlugin, Utils } from '@clappr/core';
import { trace } from '@gcorevideo/utils';

import { CLAPPR_VERSION } from '../../build.js';
import { ZeptoResult } from "../../utils/types.js";

import volumeMuteIcon from '../../../assets/icons/new/volume-off.svg';
import pluginHtml from '../../../assets/big-mute-button/big-mute-button.ejs';
import '../../../assets/big-mute-button/big-mute-button.scss';

const T = "plugins.big_mute_button";

/**
 * @beta
 */
export class BigMuteButton extends UICorePlugin {
  private isBigMuteButtonHidden = false;

  private _adIsPlaying = false;

  private $bigMuteBtnContainer: ZeptoResult | null = null;

  private $bigMuteButton: ZeptoResult | null = null;

  get name() {
    return 'big_mute_button';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  get template() {
    return template(pluginHtml);
  }

  override get events() {
    return {
      'click .big-mute-icon': 'handleBigMuteBtnClick',
      'click .big-mute-icon-wrapper': 'destroyBigMuteBtn',
    };
  }

  override bindEvents() {
    super.bindEvents();
    this.listenTo(this.core, Events.CORE_READY, this.onCoreReady);
    this.listenTo(this.core, 'core:advertisement:start', this.onStartAd);
    this.listenTo(this.core, 'core:advertisement:finish', this.onFinishAd);
    trace(`${T} bindEvents`, {
      mediacontrol: !!this.core.mediaControl,
    });
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_RENDERED, this.mediaControlRendered);
  }

  private unBindEvents() {
    // @ts-ignore
    this.stopListening(this.core, Events.CORE_READY);
    this.stopListening(this.core, 'core:advertisement:start', this.onStartAd);
    this.stopListening(this.core, 'core:advertisement:finish', this.onFinishAd);
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_RENDERED, this.mediaControlRendered);

    const container = this.core.activeContainer;

    if (container) {
      this.stopListening(container.playback, Events.PLAYBACK_PLAY, this.render);
    }
  }

  private onCoreReady() {
    this.listenTo(this.core.activeContainer, Events.CONTAINER_VOLUME, this.onContainerVolume);
    this.listenTo(this.core.activeContainer, Events.CONTAINER_READY, this.onContainerStart);
    this.listenTo(this.core.activePlayback, Events.PLAYBACK_ENDED, this.onPlaybackEnded);
  }

  private onContainerVolume(value: number) {
    if (value !== 0) {
      this.destroyBigMuteBtn();
    }
  }

  private onContainerStart() {
    if (this.isBigMuteButtonHidden) {
      this.showBigMuteBtn();
    }
  }

  private onPlaybackEnded() {
    this.hideBigMuteBtn();
  }

  private mediaControlRendered() {
    const container = this.core.activeContainer;

    trace(`${T} mediaControlRendered`, {
      container: !!container,
    });

    if (container) {
      this.listenTo(container.playback, Events.PLAYBACK_PLAY, () => {
        trace(`${T} PLAYBACK_PLAY`);
        this.render();
      });
    }
  }

  private onStartAd() {
    this._adIsPlaying = true;
    if (this.$bigMuteBtnContainer) {
      this.$bigMuteBtnContainer.addClass('hide');
    }
  }

  private onFinishAd() {
    this._adIsPlaying = false;
    if (this.$bigMuteBtnContainer) {
      this.$bigMuteBtnContainer.removeClass('hide');
    }
  }

  private shouldRender() {
    const container = this.core.activeContainer;

    if (!container) {
      return false;
    }

    const { autoPlay, wasMuted } = this.options;
    const volume = container.volume;

    trace(`${T} shouldRender`, {
      autoPlay,
      wasMuted,
      volume,
    });

    return autoPlay && !wasMuted && volume === 0;
  }

  override render() {
    if (this.shouldRender()) {
      trace(`${T} render`, {
        el: !!this.$el,
      });
      this.$el.html(this.template());

      this.$bigMuteBtnContainer = this.$el.find('.big-mute-icon-wrapper[data-big-mute]');
      this._adIsPlaying && this.$bigMuteBtnContainer.addClass('hide');

      this.$bigMuteButton = this.$bigMuteBtnContainer.find('.big-mute-icon');
      this.$bigMuteButton.append(volumeMuteIcon);

      const container = this.core.activeContainer;

      container.$el.append(this.$el.get(0));
    }

    return this;
  }

  private hideBigMuteBtn() {
    this.isBigMuteButtonHidden = true;
    this.$bigMuteBtnContainer?.addClass('hide');
  }

  private showBigMuteBtn() {
    this.isBigMuteButtonHidden = false;
    if (this.$bigMuteBtnContainer) {
      this.$bigMuteBtnContainer.removeClass('hide');
    }
  }

  private destroyBigMuteBtn(e?: MouseEvent) {
    this.hideBigMuteBtn();

    if (e && e.stopPropagation) {
      e.stopPropagation();
    }

    this.destroy();
  }

  private handleBigMuteBtnClick(e: MouseEvent) {
    const localVolume = Utils.Config.restore('volume');
    const volume = !isNaN(localVolume) ? localVolume : 100;

    // TODO use container.setVolume() instead
    this.core.mediaControl.setVolume(volume === 0 ? 100 : volume);

    this.destroyBigMuteBtn(e);
  }
}
