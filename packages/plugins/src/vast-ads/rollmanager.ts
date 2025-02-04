import { $, Browser, Container, ContainerPlugin, Core, Events, HTML5Video, Log, Playback, UIContainerPlugin, Utils } from '@clappr/core';
import { reportError } from '@gcorevideo/player';
import assert from 'assert';

import LoaderXML from './loaderxml.js';
import Roll from './roll.js';
import { ZeptoResult } from '../types.js';
import { AdRollDesc, AdRollItem, AdRollType, VastAdsOptions } from './types.js';

type CoreOptions = Record<string, unknown>;

type ExtensionData = Record<string, unknown>;

export default class RollManager extends Events {
  private _allURLRequest = false;

  private _container: Container;
  private container: Container;

  private _options: CoreOptions;

  private vastAdsOptions: VastAdsOptions;

  private _playback: Playback;

  private _contentElement: HTMLMediaElement;

  private _posterPlugin: UIContainerPlugin;

  private _clickToPausePlugin: ContainerPlugin;

  private adTemplates: AdRollItem[] | null = null;

  // private _adDisplayContainer: HTMLElement | null = null;

  private extension: ExtensionData | null = null;

  private firstRemaininTime = 0;

  private _imaContainer: HTMLElement | null = null;

  private isPlaying = false;

  private loadXML: LoaderXML | null = null;

  private _pr: number;

  private roll: Roll | null = null;

  constructor(
    private core: Core,
    private options: CoreOptions,
    private $skipAd: ZeptoResult,
    private $muteIcon: ZeptoResult,
    private $areaClick: ZeptoResult,
    private _adContainer: HTMLElement,
    private type: AdRollType,
    private countRoll: number,
    private volume: number,
    private prevVolume: number
  ) {
    super();
    this._options = options;
    this.vastAdsOptions = this._options.vastAds as any;
    this.container = this.core.activeContainer;
    this._container = this.container;
    // this.countRoll = countRoll || 0;
    this.$skipAd = $skipAd;
    this.type = type;
    this.$muteIcon = $muteIcon;
    this.$areaClick = $areaClick;
    this._playback = this.core.activePlayback;
    this._contentElement = this._playback.el as HTMLMediaElement;
    this._posterPlugin = this._container.getPlugin('poster_custom');
    this._clickToPausePlugin = this._container.getPlugin('click_to_pause_custom');
    this._adContainer = _adContainer;
    this._events = {};
    this._pr = Math.floor(Math.random() * 1000000);
  }

  private initializeRoll({ xml, url, extension }: { xml: any; url: string; extension: any }) {
    try {
      this.roll = new Roll({
        core: this.core,
        $skipAd: this.$skipAd,
        $muteIcon: this.$muteIcon,
        $areaClick: this.$areaClick,
        mute: !!this.options.mute,
        volume: this.volume,
        prevVolume: this.prevVolume
      });
      // @ts-ignore
      this.roll.on('volume', this.changeVolume.bind(this));
      // @ts-ignore
      this.roll.on('advertisement_started', this.onAdStarted.bind(this));
      // @ts-ignore
      this.roll.on('advertisement_played', this.onAdPlayed.bind(this));
      // @ts-ignore
      this.roll.on('continue_ad', this._cleverContinueAd.bind(this));
      // @ts-ignore
      this.roll.on('advertisement_finish', this._playVideoContent.bind(this));

      this.roll._requestAd({ xml, url, extension });
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
    }
  }

  playerResize(_: { width: number; height: number }) {
    if (this.roll) {
      this.roll.playerResize();
    }
  }

  private onAdStarted(_: { url: string}) {
    this.removeContainer();
  }

  onAdPlayed() {
    this.isPlaying = true;
  }

  private removeContainer() {
    this.trigger('advertisement_started');
  }

  private changeVolume(obj: { volume: number; mute: boolean; }) {
    this.trigger('volume', obj);
  }

  // private _createAdDisplayContainer() {
  //   this._createImaContainer();
  //   assert('google' in window, 'google not found');
  //   this._adDisplayContainer = new (window.google as any).ima.AdDisplayContainer(this._imaContainer, this._contentElement);
  // }

  _createImaContainer() {
    this._destroyImaContainer();
    // IMA does not clean ad container when finished
    // For the sake of simplicity, wrap into a <div> element
    if (this._adContainer) {
      this._imaContainer = document.createElement('div');
      this._adContainer.appendChild(this._imaContainer);
    }
  }

  _destroyImaContainer() {
    if (this._imaContainer && this._adContainer) {
      this._adContainer.removeChild(this._imaContainer);
      this._imaContainer = null;
    }
  }

  async setupRoll() {
    // TODO: check if this is correct
    const dataAd = this.vastAdsOptions[this.type] || { data: [] };
    const { oneByOne = false } = dataAd;
    let rollList = dataAd.data;

    if (this.type === 'middleroll') {
      const currentStartTime = dataAd.data[this.countRoll].startTimePercent;

      rollList = dataAd.data.filter((el) => {
        if (el.startTimePercent === currentStartTime) {
          return true;
        }
      });
    }
    if (this.type === 'repeatableroll') {
      const currentStartTime = dataAd.data[this.countRoll].startTime;

      rollList = dataAd.data.filter((el) => {
        if (el.startTime === currentStartTime) {
          return true;
        }
      });
    }

    if (this.type === 'middleroll' || this.type === 'repeatableroll') {
      this.trigger('change_counter', { type: this.type, value: this.countRoll + rollList.length });
    }
    await this.startAd(this.type, { data: rollList, oneByOne });
  }

  async startAd(type: AdRollType, roll: AdRollDesc) {
    // TODO
    // Player.player.trigger('advertisementWasStarted');
    this.core.trigger('core:advertisement:start');
    this.container.trigger('container:advertisement:start');
    (this.container as any).advertisement = { type: type };
    if (type !== 'middleroll' && type !== 'repeatableroll') {
      console.warn('disableControls');
      setTimeout(() => this._disableControls(), 0);
    }

    if (!this.adTemplates && roll) {
      this.adTemplates = this.parseAdUrl(roll.data);
      if (!this.adTemplates) {
        this.trigger('disable_plugin', { type: this.type });

        return;
      }
    }
    if (type === 'preroll') {
      if (Browser.isMobile) {
        this._playback.consent(() => {});
      }
    }
    //чтобы реклама шла одна за другой
    this._allURLRequest = !!roll.oneByOne;
    try {
      const customPosterPlugin = this.container.getPlugin('poster_custom');

      customPosterPlugin.hidePlayButton();
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
    }

    if (!this.adTemplates?.length) {
      this.trigger('advertisement_dont_play', { type: this.type });

      return;
    }
    Log.debug('Advertisement', 'advertisement will start');
    try {
      const adTemplate = this.adTemplates.shift();
      // @ts-ignore
      await this.loadAd(adTemplate.url);
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
    }
  }

  _disableControls() {
    this.container.disableMediaControl();
    this._clickToPausePlugin?.disable();
    // @ts-ignore
    this._posterPlugin?.$playWrapper.hide();
  }

  private parseAdUrl(arr: any): AdRollItem[] | null {
    if (!Array.isArray(arr)) {
      return null;
    }

    return arr.filter((el) => el.url);
  }

  paramsUrl(url: string): string {
    try {
      url = url.replace(/\{width\}/g, this.container.$el.width());
      url = url.replace(/\{height\}/g, this.container.$el.height());
      url = url.replace(/\{pr\}/g, String(this._pr));
      url = url.replace(/\{random\}/g, String(Math.floor(Math.random() * 1000000)));
      url = url.replace(/\{session_id\}/g, Utils.uniqueId(''));
      url = url.replace(/\{start_delay\}/g, '0');

      if (this.options.referer) {
        url = url.replace(new RegExp(/\{referer\}/g, 'g'), String(this.options.referer ?? ''));
      }

      let playback = 1;

      if (this.options.autoPlay && this.options.mute) {
        playback = 2;
      }

      if (!this.options.autoPlay) {
        playback = 3;
      }

      url = url.replace(/\{playback\}/g, String(playback));
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
    }

    return url;
  }

  async loadAd(url: string) {
    if (!url) {
      return;
    }
    try {
      if (!['middleroll', 'repeatableroll'].includes((this.container as any).advertisement.type)) {
        const spinnerPlugin = this.container.getPlugin('spinner');

        spinnerPlugin?.show();
      }
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
    }
    url = this.paramsUrl(url);

    Roll._adContainer = this._adContainer;
    Roll._contentElement = this._contentElement;
    Roll.createAdDisplayContainer();
    this.loadXML = new LoaderXML(url);
    let data: ExtensionData;

    try {
      data = await this.loadXML.startLoad();
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
      if (this.adTemplates && this.adTemplates.length > 0) {
        const adTemplate = this.adTemplates.shift();
        // @ts-ignore
        await this.loadAd(adTemplate.url);
      } else {
        const spinnerPlugin = this.container.getPlugin('spinner');

        spinnerPlugin?.hide();
        this.trigger('advertisement_dont_play', { type: this.type });
      }

      return;
    }
    try {
      this.firstRemaininTime = 0;
      this.$muteIcon.hide();
      this.$skipAd.hide();

      // this.volume = this._playback.volume;
      assert(this._playback instanceof HTML5Video);
      this.volume = (this._playback.el as HTMLMediaElement).volume;
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
    }
    this.extension = data;
    this.initializeRoll({ xml: data.config, url: String(data.url || url), extension: data });
  }

  _onAdError(adErrorEvent: any) {
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

  _imaEvent(eventName: string, e: any) {
    $.isFunction((this._events as any)[eventName]) && (this._events as any)[eventName](e);
  }

  /**
   * определяет, что дальше будет запускаться реклама или контент
   *
   */
  async _cleverContinueAd(data: any) {
    this.destroyRoll();
    const error = data.error;

    if ((this._allURLRequest || error) && this.adTemplates && this.adTemplates.length > 0) {
      const adTemplate = this.adTemplates.shift();
      // @ts-ignore
      await this.loadAd(adTemplate.url);

      return;
    }
    this._playVideoContent();
  }

  _playVideoContent() {
    this.destroyRoll();
    Roll.destroyImaContainer();

    const spinnerPlugin = this.container.getPlugin('spinner');

    spinnerPlugin?.hide();

    if (this.isPlaying) {
      this.trigger('advertisement_finish', { type: this.type });
    } else {
      this.trigger('advertisement_dont_play', { type: this.type });
    }
  }

  destroyRoll() {
    if (!this.roll) {
      return;
    }
    // @ts-ignore
    this.roll.off();
    this.roll.destroy();
    this.roll = null;
  }
}
