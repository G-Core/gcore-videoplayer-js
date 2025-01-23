import { Browser, Core, Events, Playback, template, UICorePlugin } from '@clappr/core';
import { StreamMediaSource, trace } from '@gcorevideo/player';

import { CLAPPR_VERSION } from '../build.js';

import pluginHtml from '../../assets/multi-camera/multicamera.ejs';
import '../../assets/multi-camera/style.scss';

import streamsIcon from '../../assets/icons/old/streams.svg';
import streamsMomentoIcon from '../../assets/icons/old/language.svg';
import streamsWhiteNightsIcon from '../../assets/icons/old/wn.svg';
import { ZeptoResult } from '../types.js';

type MultisourcesMode = 'one_first' | 'only_live' | 'show_all';

const VERSION = '0.0.1';

const T = 'plugins.multicamera';

export class MultiCamera extends UICorePlugin {
  private currentCamera: StreamMediaSource | null = null;

  private currentTime: number = 0;

  private playing = false;

  private multicamera: StreamMediaSource[] = [];

  private noActiveStreams = false;

  get name() {
    return 'multicamera';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  static get version() {
    return VERSION;
  }

  get template() {
    return template(pluginHtml);
  }

  override get attributes() {
    return {
      'class': this.name,
      'data-multicamera': ''
    };
  }

  override get events() {
    return {
      'click [data-multicamera-selector-select]': 'onCameraSelect',
      'click [data-multicamera-button]': 'onShowLevelSelectMenu'
    };
  }

  constructor(core: Core) {
    super(core);
    if (!this.options.multisources || !Array.isArray(this.options.multisources)) {
      this.destroy();
      return;
    }
    this.playing = this.options.multicameraPlay;
    // Don't mutate the options, TODO check if some plugin observes the options.multicamera
    this.multicamera = this.options.multisources.map((item: StreamMediaSource) => ({ ...item }));
    this.noActiveStreams = this.multicamera.every((item) => !item.live);
  }

  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.bindPlaybackEvents);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.reload);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_RENDERED, this.render);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_HIDE, this.hideSelectLevelMenu);
  }

  unBindEvents() {
    // @ts-ignore
    this.stopListening(this.core, Events.CORE_READY);
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED);
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_RENDERED);
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_HIDE);
    // @ts-ignore
    this.stopListening(this.core.activePlayback, Events.PLAYBACK_PLAY, this.onPlay);
  }

  private onPlay() {
    this.playing = true;
  }

  private bindPlaybackEvents() {
    const currentPlayback = this.core.activePlayback;

    this.listenToOnce(currentPlayback, Events.PLAYBACK_PLAY, this.onPlay);
  }

  private reload() {
    this.unBindEvents();
    this.bindEvents();
    this.bindPlaybackEvents();
  }

  private shouldRender() {
    if (!this.core.activeContainer || this.noActiveStreams) {
      return false;
    }

    if (!this.core.activePlayback) {
      return false;
    }

    return this.multicamera.length >= 2;
  }

  override render() {
    if (this.shouldRender()) {
      let numActiveSources = 0;

      for (let i = 0; i < this.multicamera.length; i++) {
        if (this.multicamera[i].live) {
          numActiveSources++;
        }
        if (this.multicamera[i].source === this.core.options.source && !this.currentCamera) {
          this.currentCamera = this.multicamera[i];
        }
      }

      if (
        this.currentTime &&
        !this.core.mediaControl.$el.hasClass('live') &&
        this.core.getPlaybackType() !== Playback.LIVE
      ) {
        if (this.currentTime < this.core.activePlayback.getDuration()) {
          this.core.activePlayback.seek(this.currentTime);
        }

        this.currentTime = 0;

        if (this.core.mediaControl.$el.hasClass('dvr')) {
          this.core.activeContainer.dvrInUse = true;
        }
      }

      // TODO current source
      this.$el
        .html(this.template({ 'streams': this.multicamera, 'multisources_mode': this.options.multisourcesMode }));

      if (
        (numActiveSources <= 1 && this.options.multisourcesMode !== "show_all") ||
        this.options.multisourcesMode === "one_first"
      ) {
        this.$el.hide();
      } else {
        this.$el.show();
      }

      if (
        this.core.mediaControl.$multiCameraSelector &&
        this.core.mediaControl.$multiCameraSelector.length > 0
      ) {
        this.core.mediaControl.$multiCameraSelector.append(this.el);
      } else {
        this.core.mediaControl.$('.media-control-right-panel').append(this.el);
      }
      if (
        Object.prototype.hasOwnProperty.call(this.core.mediaControl, '$multiCameraSelector') &&
        this.core.mediaControl.$multiCameraSelector.find('span.multicamera-icon').length > 0
      ) {
        if (~window.location.href.indexOf('whitenights.gcdn.co')) {
          this.core.mediaControl.$multiCameraSelector.find('span.multicamera-icon').append(streamsWhiteNightsIcon);
        } else if (~window.location.href.indexOf('momentosolutions.gcdn.co')) {
          this.core.mediaControl.$multiCameraSelector.find('span.multicamera-icon').append(streamsMomentoIcon);
        } else {
          this.core.mediaControl.$multiCameraSelector.find('span.multicamera-icon').append(streamsIcon);
        }
      }
      this.highlightCurrentLevel();
    }

    return this;
  }

  private onCameraSelect(event: MouseEvent) {
    const value = (event.currentTarget as HTMLElement).dataset.multicameraSelectorSelect;
    trace(`${T} onCameraSelect ${value}`);
    if (value !== undefined) {
      this.changeById(parseInt(value, 10));
    }
    event.stopPropagation();
    return false;
  }

  activeById(id: number, active: boolean) {
    this.setLiveStatus(id, active);

    if (!this.currentCamera && !this.noActiveStreams) {
      return;
    }
    if (this.noActiveStreams && !active) {
      return;
    }

    if (this.currentCamera) {
      if (this.options.multisourcesMode === "only_live") {
        this.behaviorLive(id, active);
      }
      if (this.options.multisourcesMode === "one_first") {
        this.behaviorOne(id, active);
      }
      if (this.options.multisourcesMode === "show_all") {
        this.behaviorAll(id, active);
      }
    } else {
      if (this.noActiveStreams && active) {
        this.changeById(id);
        this.noActiveStreams = false;
      }
    }

    this.render();
  }

  setLiveStatus(id: number, active: boolean) {
    try {
      const index = this.findIndexById(id);
      if (index < 0) {
        return;
      }
      this.multicamera[index].live = active;
      if (this.levelElement(id).length) {
        this.levelElement(id)[0].dataset.multicameraSelectorLive = active;
      }
    } catch (error) {
      reportError(error);
    }
  }

  private behaviorLive(id: number, active: boolean) {
    try {
      if (active) {
        this.levelElement(id).parent().show();
      } else {
        this.levelElement(id).parent().hide();
      }
    } catch (error) {
      reportError(error);
      return;
    }

    this.findAndInitNextStream(id, active);
  }

  private behaviorOne(id: number, active: boolean) {
    this.$el.hide();
    this.findAndInitNextStream(id, active);
  }

  private behaviorAll(id: number, active: boolean) {
    if (this.currentCamera?.id === id) {
      if (active) {
        this.hideError();
        this.changeById(id);
      } else {
        this.showError();
      }
    }
  }

  private findAndInitNextStream(id: number, active: boolean) {
    if (active || this.currentCamera?.id !== id) {
      return;
    }

    const current = this.findIndexById(id);
    let counter = 1;

    while (counter < this.multicamera.length) {
      const changeIndex = (counter + current) % this.multicamera.length;
      if (this.multicamera[changeIndex].live) {
        this.changeById(this.multicamera[changeIndex].id);
        return;
      }
      counter++;
    }
    this.currentCamera = null;
    this.noActiveStreams = true;
    this.core.trigger('core:multicamera:no_active_translation');
    // this.changeById(this.multicamera[nextIndex].id);
  }

  private showError() {
    this.core.activePlayback.pause();
    setTimeout(() => {
      this.core.activePlayback.destroy();
    }, 0);
    try {
      this.core.mediaControl.disabledControlButton();
    } catch (error) {
      reportError(error);
    }
    this.core.getPlugin('error_gplayer')?.show({
      title: this.core.i18n.t('source_offline'),
      message: '',
      code: '',
      icon: '',
      reloadIcon: '',
    });
  }

  private hideError() {
    try {
      this.core.mediaControl.enableControlButton();
    } catch (error) {
      reportError(error);
    }
  }

  private changeById(id: number) {
    trace(`${T} changeById`, { id });
    queueMicrotask(() => {
      const playbackOptions = this.core.options.playback || {};

      // TODO figure out what this does
      playbackOptions.recycleVideo = Browser.isMobile;
      this.currentCamera = this.findElementById(id) ?? null;
      trace(`${T} changeById`, { id, currentCamera: this.currentCamera, multicamera: this.multicamera });

      if (!this.currentCamera) {
        return;
      }
      this.currentTime = 0;
      try {
        this.currentTime = this.core.activePlayback.getCurrentTime();
        this.highlightCurrentLevel();
        this.core.activePlayback.destroy();
      } catch (error) {
        reportError(error);
      }
      const fullscreenDisable = !!(Browser.isiOS && this.currentCamera.projection);

      // TODO remove?
      // for html5 playback:
      this.options.dvrEnabled = this.currentCamera.dvr;

      trace(`${T} changeById`, { currentCamera: this.currentCamera });
      // TODO
      this.core.configure({
        playback: playbackOptions,
        source: this.currentCamera.source, // TODO ensure that the preferred transport is used
        video360: { // TODO
          projection: this.currentCamera.projection,
        },
        fullscreenDisable,
        autoPlay: this.playing,
        disableCanAutoPlay: true
      });
      this.core.activeContainer.mediaControlDisabled = false;
    });
    this.toggleContextMenu();
  }

  getCamerasList() {
    return this.multicamera;
  }

  getCurrentCamera() {
    return this.currentCamera;
  }

  private findElementById(id: number): StreamMediaSource | undefined {
    return this.multicamera.find((element) => element.id === id);
  }

  private findIndexById(id: number): number {
    return this.multicamera.findIndex((element) => element.id === id);
  }

  private onShowLevelSelectMenu() {
    this.toggleContextMenu();
  }

  private hideSelectLevelMenu() {
    (this.$('.multicamera ul') as ZeptoResult).hide();
  }

  private toggleContextMenu() {
    (this.$('.multicamera ul') as ZeptoResult).toggle();
  }

  // private buttonElement(): ZeptoResult {
  //   return this.$('.multicamera button');
  // }

  // private buttonElementText(): ZeptoResult {
  //   return this.$('.multicamera button .quality-text');
  // }

  private levelElement(id?: number): ZeptoResult {
    return this.$('.multicamera ul li > div' + (id !== undefined ? '[data-multicamera-selector-select="' + id + '"]' : ''));
  }

  private highlightCurrentLevel() {
    this.levelElement().removeClass('current');
    this.levelElement().removeClass('multicamera-active');
    this.currentCamera && this.levelElement(this.currentCamera.id).addClass('multicamera-active');
  }
}
