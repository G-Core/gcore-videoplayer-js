import { Events, UICorePlugin, Playback, template } from '@clappr/core';

import { CLAPPR_VERSION } from '../../build.js';
import type { ZeptoResult } from '../../utils/types.js';

import pluginHtml from '../../../assets/playback-rate/playback-rate-selector.ejs';
import buttonHtml from '../../../assets/playback-rate/button.ejs';
import listHtml from '../../../assets/playback-rate/list.ejs';
import speedIcon from '../../../assets/icons/new/speed.svg';
import arrowRightIcon from '../../../assets/icons/new/arrow-right.svg';
import arrowLeftIcon from '../../../assets/icons/new/arrow-left.svg';
import checkIcon from '../../../assets/icons/new/check.svg';

type PlaybackRateOption = {
  value: string;
  label: string;
}

const DEFAULT_PLAYBACK_RATES = [
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1.0', label: '1x' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
  { value: '1.75', label: '1.75x' },
  { value: '2.0', label: '2x' }
];

const DEFAULT_PLAYBACK_RATE = '1.0';

// TODO
const MEDIACONTROL_PLAYBACKRATE = 'playbackRate';

export class PlaybackRate extends UICorePlugin {
  private currentPlayback: Playback | null = null;

  private playbackRates: PlaybackRateOption[] = DEFAULT_PLAYBACK_RATES;

  private prevSelectedRate: string | undefined;

  private selectedRate: string = DEFAULT_PLAYBACK_RATE;

  get name() {
    return 'media_control_playback_rate';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  get template() {
    return template(pluginHtml);
  }

  override get attributes() {
    return {
      'class': this.name,
      'data-playback-rate-select': ''
    };
  }

  override get events() {
    return {
      'click .gear-sub-menu_btn': 'onRateSelect',
      'click .gear-option': 'onShowMenu',
      'click .go-back': 'goBack',
    };
  }

  override bindEvents() {
    this.listenTo(this.core, 'gear:rendered', this.render);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.reload);
    this.listenTo(this.core.mediaControl, MEDIACONTROL_PLAYBACKRATE, this.updatePlaybackRate);

    this.listenTo(this.core, 'core:advertisement:start', this.onStartAd);
    this.listenTo(this.core, 'core:advertisement:finish', this.onFinishAd);
    if (this.core.activeContainer) {
      this.listenTo(this.core.activePlayback, Events.PLAYBACK_BUFFERFULL, this.updateLiveStatus);
    }

    if (this.currentPlayback) {
      this.listenTo(this.currentPlayback, Events.PLAYBACK_STOP, this.onStop);
      this.listenTo(this.currentPlayback, Events.PLAYBACK_PLAY, this.onPlay);

      // TODO import dash playback events
      this.listenTo(this.currentPlayback, 'dash:playback-rate-changed', this.onDashRateChange);
    }
  }

  unBindEvents() {
    this.stopListening(this.core, 'gear:rendered', this.render);
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.reload);
    this.stopListening(this.core, 'core:advertisement:start', this.onStartAd);
    this.stopListening(this.core, 'core:advertisement:finish', this.onFinishAd);
  }

  private allRateElements(): ZeptoResult {
    return this.$('ul.gear-sub-menu li');
  }

  private rateElement(rate = "1"): ZeptoResult {
    return (this.$(`ul.gear-sub-menu a[data-rate="${rate}"]`) as ZeptoResult).parent();
  }

  private onDashRateChange() {
    // TODO consider removing
    ((this.currentPlayback as any)._dash as any)?.setPlaybackRate(this.selectedRate);
  }

  private updateLiveStatus() {
    if (this.core.getPlaybackType() === Playback.LIVE) {
      if (this.core.mediaControl.currentSeekBarPercentage <= 98.9) {
        this.core.mediaControl.$playbackRate.removeClass('playbackrate-enable');
        this.core.mediaControl.$el.addClass('dvr');

        return;
      }
      this.updatePlaybackRate(DEFAULT_PLAYBACK_RATE);
      this.core.mediaControl.$playbackRate.addClass('playbackrate-enable');
      this.core.mediaControl.$el.removeClass('dvr');
    }
  }

  reload() {
    this.unBindEvents();
    this.bindEvents();
  }

  private shouldRender() {
    if (!this.core.activeContainer) {
      return false;
    }

    this.currentPlayback = this.core.activePlayback;

    return !(this.currentPlayback?.tagName !== 'video' && this.currentPlayback?.tagName !== 'audio');
  }

  override render() {
    const container = this.core.activeContainer;

    if (this.core.getPlaybackType() === Playback.LIVE && !container.isDvrEnabled()) {
      return this;
    }
    const cfg = this.core.options.playbackRateConfig || {};

    if (!this.playbackRates) {
      this.playbackRates = cfg.options || DEFAULT_PLAYBACK_RATES;
    }

    if (!this.selectedRate) {
      this.selectedRate = cfg.defaultValue || DEFAULT_PLAYBACK_RATE;
    }

    if (this.shouldRender()) {
      const t = template(buttonHtml);
      // const html = t({ playbackRates: this.playbackRates, title: this.getTitle() });
      const button = t({
        title: this.getTitle(),
        speedIcon,
        arrowRightIcon,
      });

      this.$el.html(button);

      // if (this.core.getPlaybackType() === Playback.LIVE) {
      //   this.core.mediaControl.$playbackRate.addClass('playbackrate-enable');
      // }

      // this.core.mediaControl.$playbackRate.append(this.el);

      this.core.mediaControl.$el?.find('.gear-options-list [data-rate]').html(this.el);

      // this.updateText();
    }

    return this;
  }

  onStartAd() {
    this.prevSelectedRate = this.selectedRate;
    this.setSelectedRate('1.0');
    this.listenToOnce(this.currentPlayback, Events.PLAYBACK_PLAY, this.onFinishAd);
  }

  onFinishAd() {
    if (this.prevSelectedRate) {
      this.setSelectedRate(this.prevSelectedRate);
    }
  }

  onPlay() {
    if (!this.core.mediaControl.$el.hasClass('dvr')) {
      if (this.core.getPlaybackType() === Playback.LIVE) {
        this.updatePlaybackRate(DEFAULT_PLAYBACK_RATE);
        this.core.mediaControl.$playbackRate.addClass('playbackrate-enable');
      }
    } else {
      this.setSelectedRate(this.selectedRate);
    }
  }

  onStop() {

  }

  onRateSelect(event: MouseEvent) {
    event.stopPropagation();
    const rate = (event.currentTarget as HTMLElement).dataset.rate;
    if (rate) {
      this.setSelectedRate(rate);
      this.highlightCurrentRate();
    }

    return false;
  }

  onShowMenu() {
    const t = template(listHtml);

    this.$el.html(t({
      playbackRates: this.playbackRates,
      arrowLeftIcon,
      checkIcon,
    }));

    this.core.mediaControl.$el?.find('.gear-wrapper').html(this.el);
    this.highlightCurrentRate();
  }

  goBack() {
    this.core.trigger('gear:refresh');
  }

  updatePlaybackRate(rate: string) {
    this.setSelectedRate(rate);
  }

  setSelectedRate(rate: string) {
    // Set <video playbackRate="..."
    this.core.$el.find('video,audio').get(0).playbackRate = rate;
    this.selectedRate = rate;
    // TODO
    // Player.player.trigger('playbackRateChanged', rate);
  }

  getTitle() {
    let title = this.selectedRate;

    this.playbackRates.forEach((r) => {
      if (r.value === this.selectedRate) {
        title = r.label;
      }
    });

    return title;
  }

  highlightCurrentRate() {
    this.allRateElements().removeClass('current');
    this.allRateElements().find('a').removeClass('gcore-skin-active');

    const currentLevelElement = this.rateElement(this.selectedRate);

    currentLevelElement.addClass('current');
    currentLevelElement.find('a').addClass('gcore-skin-active');
  }
}
