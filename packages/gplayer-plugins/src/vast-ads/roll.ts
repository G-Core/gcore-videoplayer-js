// import LogManager from '../../utils/LogManager';
import { $, Container, Core, Events, Log, Playback } from '@clappr/core';
import { reportError } from '@gcorevideo/utils';
import assert from 'assert';

import type { TimerId, ZeptoResult } from '../types.js';

type RollConstructorOptions = {
  core: Core;
  $skipAd: ZeptoResult;
  $muteIcon: ZeptoResult;
  $areaClick: ZeptoResult;
  mute: boolean;
  volume: number;
  prevVolume: number;
};

export default class Roll extends Events {
  private mute: boolean;
  private core: Core;
  private container: Container;
  private $skipAd: ZeptoResult;
  private $muteIcon: ZeptoResult;
  private $areaClick: ZeptoResult;
  private _playback: Playback;
  private _volume: number;
  private _prevValueVolume: number;

  private _useDummyMp4Video = false;

  private firstRemaininTime = 0;

  private intervalTimer: TimerId | null = null;

  private _isAdStartedTriggered: boolean;

  private extension: any;

  private _adsManager: any;

  private url: string = '';

  // _events: Record<string, Function>;
  
  constructor({ core, $skipAd, $muteIcon, $areaClick, mute, volume, prevVolume }: RollConstructorOptions) {
    super();
    this.mute = mute;
    this.core = core;
    this.container = this.core.activeContainer;
    this.$skipAd = $skipAd;
    this.$muteIcon = $muteIcon;
    this.$areaClick = $areaClick;
    this._playback = this.core.activePlayback;
    this._volume = volume;
    this._prevValueVolume = prevVolume;
    this._isAdStartedTriggered = false;
    // this._events = {};
  }

  static _adContainer: any;

  private static _adDisplayContainer: any;

  private static _imaContainer: any;

  static _contentElement: HTMLMediaElement | null = null;

  static createAdDisplayContainer() {
    Roll.createImaContainer();
    assert('google' in window, 'Google IMA SDK not found');
    Roll._adDisplayContainer = new (window.google as any).ima.AdDisplayContainer(Roll._imaContainer, Roll._contentElement);
  }

  static createImaContainer() {
    Roll.destroyImaContainer();
    // IMA does not clean ad container when finished
    // For the sake of simplicity, wrap into a <div> element
    if (Roll._adContainer) {
      Roll._imaContainer = document.createElement('div');
      Roll._adContainer.appendChild(Roll._imaContainer);
    }
  }

  static destroyImaContainer() {
    if (Roll._imaContainer && Roll._adContainer) {
      Roll._adContainer.removeChild(Roll._imaContainer);
      delete Roll._imaContainer;
    }
  }

  private _onAdError(adErrorEvent: any) {
    try {
      const googleError = adErrorEvent.getError();
      const error = new Error(googleError.getMessage() + ' ' + googleError.getErrorCode());

      error.name = googleError.getType();
      // LogManager.exception(error);
      reportError(error);
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
    }
    Log.debug('Advertisement', 'advertisement error');
    this._cleverContinueAd(true);
  }

  async _playAds() {
    await Roll._adDisplayContainer.initialize();
    try {
      assert('google' in window, 'Google IMA SDK not found');
      assert(Roll._contentElement, 'content element not found');
      this._adsManager.init(
        Roll._contentElement.offsetWidth,
        Roll._contentElement.offsetHeight,
        (window.google as any).ima.ViewMode.NORMAL);
      this._adsManager.start();
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
      this._imaEvent('error', error);
      this._playVideoContent();
    }
  }

  private _setVolume(volume: number) {
    try {
      if (this._adsManager) {
        this._adsManager.setVolume(volume / 100);
      }
      if (typeof this.core.mediaControl.setVolume === 'function') {
        this.core.options.mute = !volume;

        this.trigger('volume', {
          volume,
          mute: this.core.options.mute
        });

        if ((this.container as any).advertisement.type !== 'scteroll') {
          this.core.mediaControl.setVolume(volume, true);
        } else {
          if (volume) {
            (this.container as any).advertisement.isMuted = true;
          } else {
            this.core.mediaControl.setVolume(volume, true);
            (this.container as any).advertisement.isMuted = false;
          }
        }
      }
      this._volume = volume;
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
    }
  }

  _playVideoContent() {
    this.destroy();
    this.trigger('advertisement_finish');
  }

  _hideControls() {
    if (this.extension && this.extension.controls === '0') {
      this.$skipAd.css({ opacity: 0, visibility: 'hidden' });
      this.$muteIcon.css({ opacity: 0, visibility: 'hidden' });
    } else {
      this.$skipAd.css({ opacity: 1, visibility: 'visible' });
      this.$muteIcon.css({ opacity: 1, visibility: 'visible' });
    }
  }

  _requestAd({ xml, url, extension }: { xml: any; url: string; extension: any }) {
    this.extension = extension;
    assert('google' in window, 'Google IMA SDK not found');
    const adsLoader = new (window.google as any).ima.AdsLoader(Roll._adDisplayContainer);

    adsLoader.addEventListener(
      (window.google as any).ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      (e: any) => {
        this._onAdsManagerLoaded(e);
      }
    );

    adsLoader.addEventListener(
      (window.google as any).ima.AdErrorEvent.Type.AD_ERROR,
      (e: any) => {
        this._onAdError(e);
      }
    );
    const adsRequest = new (window.google as any).ima.AdsRequest();

    if (xml) {
      adsRequest.adTagUrl = '';
      adsRequest.adsResponse = xml;
    } else {
      if (url) {
        adsRequest.adTagUrl = url;
      } else {
        throw 'no ad url';
      }
    }
    this.url = url;

    assert(Roll._contentElement, 'content element not found');
    adsRequest.linearAdSlotWidth = Roll._contentElement.offsetWidth;
    adsRequest.linearAdSlotHeight = Roll._contentElement.offsetHeight;
    adsRequest.nonLinearAdSlotWidth = Roll._contentElement.offsetWidth;
    adsRequest.nonLinearAdSlotHeight = Roll._contentElement.offsetHeight;
    adsLoader.requestAds(adsRequest);
  }

  playerResize() {
    assert(Roll._contentElement, 'content element not found');
    assert('google' in window, 'Google IMA SDK not found');
    this._adsManager && this._adsManager.resize(
      Roll._contentElement.offsetWidth,
      Roll._contentElement.offsetHeight,
      (window.google as any).ima.ViewMode.NORMAL);
  }

  _onAdsManagerLoaded(adsManagerLoadedEvent: any) {
    assert('google' in window, 'Google IMA SDK not found');
    const adsRenderingSettings = new (window.google as any).ima.AdsRenderingSettings();

    adsRenderingSettings.loadVideoTimeout = process.env.MINIMIZE ? 4000 : 8000;
    adsRenderingSettings.bitrate = 100000;
    // Plugin will handle playback state when ad has completed

    this._adsManager = adsManagerLoadedEvent.getAdsManager(Roll._contentElement, adsRenderingSettings);
    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.LOADED, () => {
      if (this.mute) {
        this._setVolume(0);
      } else {
        this._setVolume(this._volume);
      }

      this.changeIconVolume();
    });
    this._adsManager.addEventListener((window.google as any).ima.AdErrorEvent.Type.AD_ERROR, (e: any) => {
      const adType = (this.container as any).advertisement.type;

      if (!((adType === 'middleroll' || adType === 'repeatableroll') && !this._playback.isPlaying())) {
        this._onAdError(e);
      }
    });
    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, () => {
      this._imaEvent('content_resume_requested');
    });
    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED, () => {
      this._imaEvent('content_pause_requested');
      this._triggerStartAd(this.url);
    });
    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.CLICK, () => {
      this._imaEvent('click');
    });
    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.IMPRESSION, () => {
      this._imaEvent('impression');
    });
    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.STARTED, (adEvent: any) => {
      this._triggerStartAd(this.url);
      this.trigger('advertisement_played');
      const ad = adEvent.getAd();

      try {
        assert(Roll._contentElement, 'content element not found');
        assert('google' in window, 'Google IMA SDK not found');
        this._adsManager && this._adsManager.resize(
          Roll._contentElement.offsetWidth,
          Roll._contentElement.offsetHeight,
          (window.google as any).ima.ViewMode.NORMAL);
      } catch (error) {
        // LogManager.exception(error);
        reportError(error);
      }

      if (this.mute) {
        this._setVolume(0);
      } else {
        this._setVolume(this._volume);
      }

      if (ad.isLinear()) {
        // For a linear ad, a timer can be started to poll for
        // the remaining time.

        this.intervalTimer = setInterval(() => {
          this._remainingTime(ad);
        },
          300); // every 300ms
      }
    });
    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.FIRST_QUARTILE, () => {
      this._imaEvent('first_quartile');
    });
    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.MIDPOINT, () => {
      this._imaEvent('midpoint');
    });
    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.THIRD_QUARTILE, () => {
      this._imaEvent('third_quartile');
    });
    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.COMPLETE, () => {
      this._imaEvent('complete');
      this._useDummyMp4Video = false;
    });
    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.ALL_ADS_COMPLETED, () => {
      this._imaEvent('all_ads_completed');
      this._cleverContinueAd();
      this._useDummyMp4Video = false;
    });

    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.PAUSED, () => {
      this._imaEvent('paused');
    });

    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.RESUMED, () => {
      this._imaEvent('resumed');
    });

    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.SKIPPED, () => {
      this._imaEvent('skipped');
      if (this.extension && this.extension.skipAd) {
        this._trackUrl(this.extension.skipAd);
      }
    });

    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.VOLUME_CHANGED, () => {
      this._imaEvent('volume_change');
      this.changeIconVolume();
    });

    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.VOLUME_MUTED, () => {
      this._imaEvent('volume_muted');
      this.changeIconVolume();
    });

    this._adsManager.addEventListener((window.google as any).ima.AdEvent.Type.USER_CLOSE, () => {
      this._imaEvent('user_close');
    });

    if (this.mute) {
      this._setVolume(0);
    } else {
      this._setVolume(this._volume);
    }
    this._setupOverlay();
  }

  _triggerStartAd(url: string) {
    if (!this._isAdStartedTriggered) {
      this._isAdStartedTriggered = true;
      this.trigger('advertisement_started', {
        url
      });
    }
  }

  _remainingTime(ad: any) {
    if (!ad || !this._adsManager) {
      return;
    }
    const remainingTime = Math.abs(this._adsManager.getRemainingTime());
    const duration = ad.getDuration() || ad.getMinSuggestedDuration();

    if (!this.firstRemaininTime) {
      this.firstRemaininTime = this._adsManager.getRemainingTime();
    }

    const shouldShowSkip = remainingTime < this.firstRemaininTime &&
      this.extension.timeOffset > -1 &&
      this.firstRemaininTime > this.extension.timeOffset &&
      !(duration > 0 && Math.abs(duration) < this.extension.timeOffset);

    if (!shouldShowSkip) {
      return;
    }

    this.$skipAd.show();
    const offset = Math.round(this.extension.timeOffset - Math.abs(this.firstRemaininTime - remainingTime));

    if (offset > 0) {
      this.$skipAd.addClass('skip-ad-time');
      this.$skipAd.text(this.core.i18n.t('you_can_skip_ad') + ' ' + offset);
    } else {
      this.$skipAd.removeClass('skip-ad-time');
      this.$skipAd.text(this.core.i18n.t('skip_ad'));
    }
  }

  private _cleverContinueAd(error?: any) {
    try {
      this.destroy();
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
    }
    this.trigger('continue_ad', { error });
  }

  private _imaEvent(eventName: string, e?: any) {
    $.isFunction((this._events as any)[eventName]) && (this._events as any)[eventName](e);
  }

  changeIconVolume() {
    if (!this._adsManager) {
      return;
    }
    this.$muteIcon.show();
    if (this._adsManager.getVolume() === 0) {
      if (!this._volume && this._adsManager.getVolume()) {
        this._volume = this._adsManager.getVolume() * 100;
      }
      this.$muteIcon.find('.mute-off-ad-icon').show();
      this.$muteIcon.find('.mute-on-ad-icon').hide();
    } else {
      this._volume = this._adsManager.getVolume() * 100;
      this.$muteIcon.find('.mute-on-ad-icon').show();
      this.$muteIcon.find('.mute-off-ad-icon').hide();
    }
  }

  _setupOverlay() {
    this.$muteIcon.off('click');
    this.$skipAd.off('click');
    this.$areaClick.off('click');
    this.$muteIcon.off();
    this.$skipAd.off();
    this.$areaClick.off();
    this.$muteIcon.on('click', () => {
      if (this._adsManager) {
        if (this._adsManager.getVolume() === 0) {
          this._setVolume((this._prevValueVolume ? this._prevValueVolume : this._volume));
        } else {
          this._setVolume(0);
        }
        this.changeIconVolume();
      }
    });
    this.$skipAd.on('click', () => {
      if (this.extension.skipEvents) {
        this._trackUrls(this.extension.skipEvents);
      }
      if (this.extension.progressEvents) {
        this._trackUrls(this.extension.progressEvents);
      }
      if (this.extension && this.extension.skipAd) {
        this._trackUrl(this.extension.skipAd);
      }
      this._adsManager.stop();
      console.warn('skip ad');
    });

    if (this.extension.clickThrough) {
      this.$areaClick.show();
      this.$areaClick.on('click', () => {
        window.open(this.extension.clickThrough, '_blank');
        console.warn(this.extension.clickTrackings);
        if (this.extension.clickTrackings.length) {
          this._trackUrls(this.extension.clickTrackings);
        }
      });
    }

    this._hideControls();

    this._playAds();
  }

  _trackUrls(urls: string[]) {
    for (let i = 0; i < urls.length; i++) {
      this._trackUrl(urls[i]);
    }
  }

  _trackUrl(url: string) {
    if (url) {
      const i = new Image();

      i.src = url;
    }
  }

  destroy() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (Roll._adDisplayContainer) {
      if (this._adsManager) {
        this._adsManager.destroy();
      }
    }
  }
}
