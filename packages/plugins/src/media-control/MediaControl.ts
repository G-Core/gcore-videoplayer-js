// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/**
 * The MediaControl is responsible for displaying the Player controls.
 */

import assert from 'assert';
import {
  Events,
  UICorePlugin,
  Browser,
  Playback,
  Player as PlayerClappr,
  Utils,
  template,
  $,
} from '@clappr/core';
import {
  reportError,
  TimeProgress,
} from '@gcorevideo/player';
import { Kibo } from '../kibo/index.js';

import { CLAPPR_VERSION } from '../build.js';
import { ZeptoResult } from "../types";
import { getPageX, isFullscreen } from '../utils.js';

import '../../assets/media-control/media-control.scss';
import '../../assets/media-control/plugins.scss';

import mediaControlHTML from '../../assets/media-control/media-control.ejs';
import playIcon from '../../assets/icons/new/play.svg';
import pauseIcon from '../../assets/icons/new/pause.svg';
import stopIcon from '../../assets/icons/new/stop.svg';
import volumeMaxIcon from '../../assets/icons/new/volume-max.svg';
import volumeOffIcon from '../../assets/icons/new/volume-off.svg';
import fullscreenOffIcon from '../../assets/icons/new/fullscreen-off.svg';
import fullscreenOnIcon from '../../assets/icons/new/fullscreen-on.svg';

type MediaControlElement = 'pip'; // TODO

const T = 'plugins.media_control';

const { Config, Fullscreen, formatTime, extend, removeArrayItem } = Utils;

function orderByOrderPattern(arr: string[], order: string[]): string[] {
  const arrWithoutDuplicates = [...new Set(arr)];
  const ordered = order.filter(item => arrWithoutDuplicates.includes(item));

  const rest = arrWithoutDuplicates.filter(item => !order.includes(item));

  return [...ordered, ...rest];
}

type DisabledClickable = {
  el: ZeptoResult;
  pointerEventValue: string;
}

export class MediaControl extends UICorePlugin {
  private advertisementPlaying = false;

  private buttonsColor: string | null = null;

  private currentDurationValue: number = 0;
  private currentPositionValue: number = 0;
  private currentSeekBarPercentage: number | null = null;

  private disabledClickableList: DisabledClickable[] = [];
  private displayedDuration: string | null = null;
  private displayedPosition: string | null = null;
  private displayedSeekBarPercentage: number | null = null;

  private draggingSeekBar = false;
  private draggingVolumeBar = false;

  private fullScreenOnVideoTagSupported: boolean | null = null;

  private hideId: ReturnType<typeof setTimeout> | null = null;
  private hideVolumeId: ReturnType<typeof setTimeout> | null = null;

  private intendedVolume = 100;

  private isHD = false;

  private keepVisible = false;

  private kibo: Kibo;

  private lastMouseX = 0;
  private lastMouseY = 0;

  private persistConfig: boolean;

  private rendered = false;

  private settings: Record<string, unknown> = {};

  private svgMask: ZeptoResult | null = null;

  private userDisabled = false;

  private userKeepVisible = false;

  private verticalVolume = false;

  private $audioTracksSelector: ZeptoResult | null = null;

  private $bottomGear: ZeptoResult | null = null;

  private $clipText: ZeptoResult | null = null;

  private $clipTextContainer: ZeptoResult | null = null;

  private $duration: ZeptoResult | null = null;

  private $fullscreenToggle: ZeptoResult | null = null;

  private $multiCameraSelector: ZeptoResult | null = null;

  private $pip: ZeptoResult | null = null;

  private $playPauseToggle: ZeptoResult | null = null;

  private $playStopToggle: ZeptoResult | null = null;

  private $playbackRate: ZeptoResult | null = null;

  private $position: ZeptoResult | null = null;

  private $seekBarContainer: ZeptoResult | null = null;

  private $seekBarHover: ZeptoResult | null = null;

  private $seekBarLoaded: ZeptoResult | null = null;

  private $seekBarPosition: ZeptoResult | null = null;

  private $seekBarScrubber: ZeptoResult | null = null;

  private $subtitlesSelector: ZeptoResult | null = null;

  private $volumeBarContainer: ZeptoResult | null = null;

  private $volumeBarBackground: ZeptoResult | null = null;

  private $volumeBarFill: ZeptoResult | null = null;

  private $volumeBarScrubber: ZeptoResult | null = null;

  private $volumeContainer: ZeptoResult | null = null;

  private $volumeIcon: ZeptoResult | null = null;

  get name() {
    return 'media_control';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  get disabled() {
    const playbackIsNOOP = this.container && this.container.getPlaybackType() === Playback.NO_OP;

    return this.userDisabled || playbackIsNOOP;
  }

  get container() {
    return this.core && this.core.activeContainer;
  }

  get playback() {
    return this.core && this.core.activePlayback;
  }

  get attributes() {
    return {
      'class': 'media-control-skin-1',
      'data-media-control-skin-1': ''
    };
  }

  get events() {
    return {
      'click [data-play]': 'play',
      'click [data-pause]': 'pause',
      'click [data-playpause]': 'togglePlayPause',
      'click [data-stop]': 'stop',
      'click [data-playstop]': 'togglePlayStop',
      'click [data-fullscreen]': 'handleFullScreenOnBtn',
      'click .bar-container[data-seekbar]': 'seek',
      'click .bar-container[data-volume]': 'onVolumeClick',
      'click .drawer-icon[data-volume]': 'toggleMute',
      'mouseenter .drawer-container[data-volume]': 'showVolumeBar',
      'mouseleave .drawer-container[data-volume]': 'hideVolumeBar',
      'mousedown .bar-container[data-volume]': 'startVolumeDrag',
      'touchstart .bar-container[data-volume]': 'startVolumeDrag',
      'mousemove .bar-container[data-volume]': 'mousemoveOnVolumeBar',
      'touchmove .bar-container[data-volume]': 'mousemoveOnVolumeBar',
      'mousedown .bar-scrubber[data-seekbar]': 'startSeekDrag',
      'mousedown .bar-container[data-seekbar]': 'startSeekDrag',
      'touchstart .bar-scrubber[data-seekbar]': 'startSeekDrag',
      'touchstart .bar-container[data-seekbar]': 'startSeekDrag',
      'mousemove .bar-container[data-seekbar]': 'mousemoveOnSeekBar',
      'touchmove .bar-container[data-seekbar]': 'mousemoveOnSeekBar',
      'mouseleave .bar-container[data-seekbar]': 'mouseleaveOnSeekBar',
      'touchend .bar-container[data-seekbar]': 'mouseleaveOnSeekBar',
      'mouseenter .media-control-layer[data-controls]': 'setUserKeepVisible',
      'mouseleave .media-control-layer[data-controls]': 'resetUserKeepVisible'
    };
  }

  get template() {
    return template(mediaControlHTML);
  }

  get volume() {
    return (this.container && this.container.isReady) ? this.container.volume : this.intendedVolume;
  }

  get muted() {
    return this.volume === 0;
  }

  constructor(core: PlayerClappr) {
    super(core);
    this.persistConfig = this.options.persistConfig;
    this.setInitialVolume();

    this.kibo = new Kibo(this.options.focusElement);
    this.bindKeyEvents();

    this.userDisabled = false;
    if ((this.container && this.container.mediaControlDisabled) || this.options.chromeless) {
      this.disable();
    }

    $(document).bind('mouseup', this.stopDrag);
    $(document).bind('mousemove', this.updateDrag);

    $(document).bind('touchend', this.stopDrag);
    $(document).bind('touchmove', this.updateDrag);
  }

  getExternalInterface() {
    return {
      setVolume: this.setVolume,
      getVolume: () => this.volume,
    };
  }

  bindEvents() {
    // @ts-ignore
    this.stopListening();
    this.listenTo(this.core, Events.CORE_ACTIVE_CONTAINER_CHANGED, this.onActiveContainerChanged);
    this.listenTo(this.core, Events.CORE_MOUSE_MOVE, this.show);
    this.listenTo(this.core, Events.CORE_MOUSE_LEAVE, () => this.hide(this.options.hideMediaControlDelay));
    this.listenTo(this.core, Events.CORE_FULLSCREEN, this.show);
    this.listenTo(this.core, Events.CORE_OPTIONS_CHANGE, this.configure);
    this.listenTo(this.core, Events.CORE_RESIZE, this.playerResize);
    this.bindContainerEvents();

    this.listenTo(this.core, 'core:advertisement:start', this.onStartAd);
    this.listenTo(this.core, 'core:advertisement:finish', this.onFinishAd);

    // const has360 = this.core?.getPlugin('video_360');

    // if (Browser.isiOS && has360) {
    //   this.container?.el.addEventListener('click', e => {
    //     e.preventDefault();
    //     e.stopPropagation();
    //     // feature detect
    //     if (typeof DeviceMotionEvent.requestPermission === 'function') {
    //       DeviceMotionEvent.requestPermission()
    //         .then(permissionState => {
    //           if (permissionState === 'granted') {
    //             console.warn('Permission granted');
    //           }
    //         })
    //         .catch(console.error);
    //     } else {
    //       // handle regular non iOS 13+ devices
    //     }
    //   });
    // }
  }

  bindContainerEvents() {
    if (!this.container) {
      return;
    }
    this.listenTo(this.container, Events.CONTAINER_PLAY, this.changeTogglePlay);
    this.listenTo(this.container, Events.CONTAINER_PAUSE, this.changeTogglePlay);
    this.listenTo(this.container, Events.CONTAINER_STOP, this.changeTogglePlay);
    this.listenTo(this.container, Events.CONTAINER_DBLCLICK, this.toggleFullscreen);
    this.listenTo(this.container, Events.CONTAINER_TIMEUPDATE, this.onTimeUpdate);
    this.listenTo(this.container, Events.CONTAINER_PROGRESS, this.updateProgressBar);
    this.listenTo(this.container, Events.CONTAINER_SETTINGSUPDATE, this.settingsUpdate);
    this.listenTo(this.container, Events.CONTAINER_PLAYBACKDVRSTATECHANGED, this.settingsUpdate);
    this.listenTo(this.container, Events.CONTAINER_HIGHDEFINITIONUPDATE, this.highDefinitionUpdate);
    this.listenTo(this.container, Events.CONTAINER_MEDIACONTROL_DISABLE, this.disable);
    this.listenTo(this.container, Events.CONTAINER_MEDIACONTROL_ENABLE, this.enable);
    this.listenTo(this.container, Events.CONTAINER_ENDED, this.ended);
    this.listenTo(this.container, Events.CONTAINER_VOLUME, this.onVolumeChanged);
    this.listenTo(this.container, Events.CONTAINER_OPTIONS_CHANGE, this.setInitialVolume);
    if (this.container.playback.el.nodeName.toLowerCase() === 'video') {
      // wait until the metadata has loaded and then check if fullscreen on video tag is supported
      this.listenToOnce(this.container, Events.CONTAINER_LOADEDMETADATA, this.onLoadedMetadataOnVideoTag);
    }
  }

  disable() {
    this.userDisabled = true;
    this.hide();
    this.unbindKeyEvents();
    this.$el.hide();
  }

  enable() {
    if (this.options.chromeless) {
      return;
    }
    this.userDisabled = false;
    this.bindKeyEvents();
    this.show();
  }

  play() {
    this.container && this.container.play();
  }

  pause() {
    this.container && this.container.pause();
  }

  stop() {
    this.container && this.container.stop();
  }

  setInitialVolume() {
    const initialVolume = (this.persistConfig) ? Config.restore('volume') : 100;
    const options = this.container && this.container.options || this.options;

    this.setVolume(options.mute ? 0 : initialVolume, true);
  }

  onVolumeChanged() {
    this.updateVolumeUI();
  }

  onLoadedMetadataOnVideoTag(event: any) {
    const video = this.playback && this.playback.el;

    // video.webkitSupportsFullscreen is deprecated but iOS appears to only use this
    // see https://github.com/clappr/clappr/issues/1127
    if (!Fullscreen.fullscreenEnabled() && video.webkitSupportsFullscreen) {
      this.fullScreenOnVideoTagSupported = true;
      this.settingsUpdate(null);
    }
  }

  updateVolumeUI() {
    // this will be called after a render
    if (!this.rendered) {
      return;
    }

    assert.ok(this.$volumeBarContainer, 'volume bar container must be present');
    // update volume bar scrubber/fill on bar mode
    // this.$volumeBarContainer.find('.bar-fill-2').css({});
    const containerWidth = this.$volumeBarContainer.width();

    assert.ok(this.$volumeBarBackground, 'volume bar background must be present');
    const barWidth = this.$volumeBarBackground.width();
    const offset = (containerWidth - barWidth) / 2.0;
    const pos = barWidth * this.volume / 100.0 + offset;

    assert.ok(this.$volumeBarFill, 'volume bar fill must be present');
    this.$volumeBarFill.css({ width: `${this.volume}%` });
    this.$volumeBarFill.css({ width: `${this.volume}%` });

    assert.ok(this.$volumeBarScrubber, 'volume bar scrubber must be present');
    this.$volumeBarScrubber.css({ left: pos });

    // update volume bar segments on segmented bar mode
    this.$volumeBarContainer.find('.segmented-bar-element').removeClass('fill');
    const item = Math.ceil(this.volume / 10.0);

    this.$volumeBarContainer.find('.segmented-bar-element').slice(0, item).addClass('fill');
    assert.ok(this.$volumeIcon, 'volume icon must be present');
    this.$volumeIcon.html('');
    this.$volumeIcon.removeClass('muted');
    if (!this.muted) {
      this.$volumeIcon.append(volumeMaxIcon);
    } else {
      this.$volumeIcon.append(volumeOffIcon);
      this.$volumeIcon.addClass('muted');
    }
    this.applyButtonStyle(this.$volumeIcon);

    this.$volumeBarScrubber.css({ left: `${this.volume}%` });
    this.$volumeIcon.html('');
    this.$volumeIcon.removeClass('muted');

    if (!this.muted) {
      this.$volumeIcon.append(volumeMaxIcon);
    } else {
      this.$volumeIcon.append(volumeOffIcon);
      this.$volumeIcon.addClass('muted');
    }
    this.applyButtonStyle(this.$volumeIcon);
  }

  changeTogglePlay() {
    // assert.ok(this.$playPauseToggle, 'play/pause toggle must be present');
    this.$playPauseToggle?.html('');

    // assert.ok(this.$playStopToggle, 'play/stop toggle must be present');
    this.$playStopToggle?.html('');
    if (this.container && this.container.isPlaying()) {
      this.$playPauseToggle?.append(pauseIcon);
      this.$playStopToggle?.append(pauseIcon);
      this.trigger(Events.MEDIACONTROL_PLAYING);
    } else {
      this.$playPauseToggle?.append(playIcon);
      this.$playStopToggle?.append(playIcon);
      this.trigger(Events.MEDIACONTROL_NOTPLAYING);
      if (Browser.isMobile) {
        this.show();
      }
    }
    this.applyButtonStyle(this.$playPauseToggle);
    this.applyButtonStyle(this.$playStopToggle);
  }

  mousemoveOnSeekBar(event: MouseEvent) {
    if (this.settings.seekEnabled) {
      // assert.ok(this.$seekBarHover && this.$seekBarContainer, 'seek bar elements must be present');
      if (this.$seekBarHover && this.$seekBarContainer) {
        const offsetX = MediaControl.getPageX(event) - this.$seekBarContainer.offset().left - this.$seekBarHover.width() / 2;

        this.$seekBarHover.css({ left: offsetX });
      }
    }
    this.trigger(Events.MEDIACONTROL_MOUSEMOVE_SEEKBAR, event);
  }

  mouseleaveOnSeekBar(event: MouseEvent) {
    this.trigger(Events.MEDIACONTROL_MOUSELEAVE_SEEKBAR, event);
  }

  onVolumeClick(event: MouseEvent) {
    this.setVolume(this.getVolumeFromUIEvent(event));
  }

  mousemoveOnVolumeBar(event: MouseEvent) {
    this.draggingVolumeBar && this.setVolume(this.getVolumeFromUIEvent(event));
  }

  playerResize(size: { width: number; height: number }) {
    if (this.container.el) {
      if (isFullscreen(this.container.el)) {
        this.$fullscreenToggle?.html(fullscreenOnIcon);
      } else {
        this.$fullscreenToggle?.html(fullscreenOffIcon);
      }
    }

    this.applyButtonStyle(this.$fullscreenToggle);
    this.$el.removeClass('w370');
    this.$el.removeClass('w270');
    this.verticalVolume = false;
    try {
      const skinWidth = this.container.$el.width() || size.width;

      if (skinWidth <= 370 || this.options.hideVolumeBar) {
        this.$el.addClass('w370');
      }

      if (skinWidth <= 270 && !Browser.isMobile) {
        this.verticalVolume = true;
        this.$el.addClass('w270');
      }
    } catch (e) {
      reportError(e);
    }
  }

  togglePlayPause() {
    this.container.isPlaying() ? this.container.pause() : this.container.play();

    return false;
  }

  togglePlayStop() {
    this.container.isPlaying() ? this.container.stop() : this.container.play();
  }

  startSeekDrag(event: MouseEvent) {
    if (!this.settings.seekEnabled) {
      return;
    }
    this.draggingSeekBar = true;
    this.$el.addClass('dragging');

    // assert.ok(this.$seekBarLoaded && this.$seekBarPosition && this.$seekBarScrubber, 'seek bar elements must be present');
    this.$seekBarLoaded?.addClass('media-control-notransition');
    this.$seekBarPosition?.addClass('media-control-notransition');
    this.$seekBarScrubber?.addClass('media-control-notransition');
    event && event.preventDefault();
  }

  startVolumeDrag(event: MouseEvent) {
    this.draggingVolumeBar = true;
    this.$el.addClass('dragging');
    event && event.preventDefault();
  }

  stopDrag = (event: MouseEvent) => {
    this.draggingSeekBar && this.seek(event);
    this.$el.removeClass('dragging');
    this.$seekBarLoaded?.removeClass('media-control-notransition');
    this.$seekBarPosition?.removeClass('media-control-notransition');
    this.$seekBarScrubber?.removeClass('media-control-notransition dragging');
    this.draggingSeekBar = false;
    this.draggingVolumeBar = false;
  }

  updateDrag = (event: MouseEvent | TouchEvent) => {
    if (this.draggingSeekBar) {
      event.preventDefault();
      const pageX = MediaControl.getPageX(event);

      assert.ok(this.$seekBarContainer, 'seek bar container must be present');
      const offsetX = pageX - this.$seekBarContainer.offset().left;
      let pos = offsetX / this.$seekBarContainer.width() * 100;

      pos = Math.min(100, Math.max(pos, 0));

      this.setSeekPercentage(pos);
    } else if (this.draggingVolumeBar) {
      event.preventDefault();
      this.setVolume(this.getVolumeFromUIEvent(event));
    }
  }

  getVolumeFromUIEvent(event: MouseEvent | TouchEvent) {
    let volumeFromUI = 0;

    assert.ok(this.$volumeBarContainer, 'volume bar container must be present');
    if (!this.verticalVolume) {
      const offsetY = MediaControl.getPageX(event) - this.$volumeBarContainer.offset().left;

      volumeFromUI = (offsetY / this.$volumeBarContainer.width()) * 100;
    } else {
      const offsetX = 80 - Math.abs(this.$volumeBarContainer.offset().top - MediaControl.getPageY(event));

      volumeFromUI = (offsetX / (this.$volumeBarContainer.height())) * 100;
    }

    return volumeFromUI;
  }

  toggleMute() {
    this.setVolume(this.muted ? 100 : 0);
  }

  setVolume(value: number, isInitialVolume = false) {
    value = Math.min(100, Math.max(value, 0));
    // this will hold the intended volume
    // it may not actually get set to this straight away
    // if the container is not ready etc
    this.intendedVolume = value;
    this.persistConfig && !isInitialVolume && Config.persist('volume', value);
    const setWhenContainerReady = () => {
      if (this.container && this.container.isReady) {
        this.container.setVolume(value);
      } else {
        this.listenToOnce(this.container, Events.CONTAINER_READY, () => {
          this.container.setVolume(value);
        });
      }
    };

    if (!this.container) {
      this.listenToOnce(this, Events.MEDIACONTROL_CONTAINERCHANGED, () => setWhenContainerReady());
    } else {
      setWhenContainerReady();
    }
  }

  toggleFullscreen() {
    if (!Browser.isMobile) {
      this.trigger(Events.MEDIACONTROL_FULLSCREEN, this.name);
      this.container.fullscreen();
      this.core.toggleFullscreen();
      this.resetUserKeepVisible();
    }
  }

  onActiveContainerChanged() {
    this.fullScreenOnVideoTagSupported = null;
    this.bindEvents();
    // set the new container to match the volume of the last one
    this.setInitialVolume();
    this.changeTogglePlay();
    this.bindContainerEvents();
    this.settingsUpdate(null);
    this.container && this.container.trigger(Events.CONTAINER_PLAYBACKDVRSTATECHANGED, this.container.isDvrInUse());
    this.container && this.container.mediaControlDisabled && this.disable();
    this.trigger(Events.MEDIACONTROL_CONTAINERCHANGED);

    if (this.container.$el) {
      this.container.$el.addClass('container-skin-1');
    }

    if (this.options.cropVideo) {
      this.container.$el.addClass('crop-video');
    }

    const spinnerPlugin = this.container.getPlugin('spinner');

    spinnerPlugin?.$el.find('div').addClass('gcore-skin-main-color');

    const seekTimePlugin = this.container.getPlugin('seek_time');

    seekTimePlugin?.$el.addClass('gcore-skin-bg-color');
    seekTimePlugin?.$el.find('span').addClass('gcore-skin-text-color');
  }

  showVolumeBar() {
    this.hideVolumeId && clearTimeout(this.hideVolumeId);
    this.$volumeBarContainer?.removeClass('volume-bar-hide');
  }

  hideVolumeBar(timeout = 400) {
    if (!this.$volumeBarContainer) {
      return;
    }
    if (this.draggingVolumeBar) {
      this.hideVolumeId = setTimeout(() => this.hideVolumeBar(), timeout);
    } else {
      this.hideVolumeId && clearTimeout(this.hideVolumeId);
      this.hideVolumeId = setTimeout(
        () => this.$volumeBarContainer?.addClass('volume-bar-hide'), timeout
      );
    }
  }

  ended() {
    this.changeTogglePlay();
  }

  updateProgressBar(progress: TimeProgress) {
    const loadedStart = progress.start / progress.total * 100;
    const loadedEnd = progress.current / progress.total * 100;

    this.$seekBarLoaded?.css({ left: `${loadedStart}%`, width: `${loadedEnd - loadedStart}%` });
  }

  onTimeUpdate(timeProgress: TimeProgress) {
    if (this.draggingSeekBar) {
      return;
    }
    // TODO why should current time ever be negative?
    const position = timeProgress.current < 0 ? timeProgress.total : timeProgress.current;

    this.currentPositionValue = position;
    this.currentDurationValue = timeProgress.total;

    if (!this.draggingSeekBar) {
      this.renderSeekBar();
    }
  }

  renderSeekBar() {
    // this will be triggered as soon as these become available
    if (this.currentPositionValue === null || this.currentDurationValue === null) {
      return;
    }

    // default to 100%
    this.currentSeekBarPercentage = 100;
    if (this.container && (this.container.getPlaybackType() !== Playback.LIVE || this.container.isDvrInUse())) {
      this.currentSeekBarPercentage = (this.currentPositionValue / this.currentDurationValue) * 100;
    }

    this.setSeekPercentage(this.currentSeekBarPercentage);

    this.drawDurationAndPosition();
  }

  drawDurationAndPosition() {
    const newPosition = formatTime(this.currentPositionValue);
    const newDuration = formatTime(this.currentDurationValue);

    if (newPosition !== this.displayedPosition) {
      this.$position?.text(newPosition);
      this.displayedPosition = newPosition;
    }
    if (newDuration !== this.displayedDuration) {
      this.$duration?.text(newDuration);
      this.displayedDuration = newDuration;
    }
  }

  seek(event: MouseEvent) {
    if (!this.settings.seekEnabled) {
      return;
    }

    assert.ok(this.$seekBarContainer, 'seek bar container must be present');
    const offsetX = MediaControl.getPageX(event) - this.$seekBarContainer.offset().left;
    let pos = offsetX / this.$seekBarContainer.width() * 100;

    pos = Math.min(100, Math.max(pos, 0));
    this.container && this.container.seekPercentage(pos);

    this.setSeekPercentage(pos);

    return false;
  }

  setKeepVisible() {
    this.keepVisible = true;
  }

  resetKeepVisible() {
    this.keepVisible = false;
  }

  setUserKeepVisible() {
    this.userKeepVisible = true;
  }

  resetUserKeepVisible() {
    this.userKeepVisible = false;
  }

  isVisible() {
    return !this.$el.hasClass('media-control-hide');
  }

  show(event?: MouseEvent) {
    if (this.disabled || this.options.disableControlPanel) {
      return;
    }

    const timeout = 2000;
    const mousePointerMoved = event && (event.clientX !== this.lastMouseX && event.clientY !== this.lastMouseY);

    if (!event || mousePointerMoved || navigator.userAgent.match(/firefox/i)) {
      if (this.hideId !== null) {
        clearTimeout(this.hideId);
        this.hideId = null;
      }
      this.$el.show();
      this.trigger(Events.MEDIACONTROL_SHOW, this.name);
      this.container && this.container.trigger(Events.CONTAINER_MEDIACONTROL_SHOW, this.name);
      this.$el.removeClass('media-control-hide');
      this.hideId = setTimeout(() => this.hide(), timeout);
      if (event) {
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
      }
    }
    const showing = true;

    this.updateCursorStyle(showing);
  }

  hide(delay = 0) {
    if (!this.isVisible()) {
      return;
    }

    const timeout = delay || 2000;

    if (this.hideId !== null) {
      clearTimeout(this.hideId);
    }

    if (!this.disabled && this.options.hideMediaControl === false) {
      return;
    }

    const hasKeepVisibleRequested = this.userKeepVisible || this.keepVisible;
    const hasDraggingAction = this.draggingSeekBar || this.draggingVolumeBar;

    if (!this.disabled && (delay || hasKeepVisibleRequested || hasDraggingAction)) {
      this.hideId = setTimeout(() => this.hide(), timeout);
    } else {
      if (!this.options.controlsDontHide || isFullscreen(this.container.el)) {
        this.trigger(Events.MEDIACONTROL_HIDE, this.name);
        this.$el.addClass('media-control-hide');
        this.hideVolumeBar(0);
        const showing = false;

        this.updateCursorStyle(showing);
      }
    }
  }

  updateCursorStyle(showing: boolean) {
    if (showing) {
      this.core.$el.removeClass('nocursor');
    } else if (this.core.isFullscreen()) {
      this.core.$el.addClass('nocursor');
    }
  }

  settingsUpdate(event: any) {
    const newSettings = this.getSettings();

    $.extend(true, newSettings, {
      left: [],
      default: [],
      right: [],
    });

    const LEFT_ORDER = ['playpause', 'playstop', 'live', 'volume', 'position', 'duration'];

    newSettings.left = orderByOrderPattern([...newSettings.left, 'clipsText', 'volume'], LEFT_ORDER);

    newSettings.right = [
      'fullscreen',
      'pip',
      'bottomgear',
      'subtitles',
      'multicamera',
      'playbackrate',
      'vr',
      'audiotracks',
    ];

    if ((!this.fullScreenOnVideoTagSupported && !Fullscreen.fullscreenEnabled()) || this.options.fullscreenDisable) {
      // remove fullscreen from settings if it is present
      removeArrayItem(newSettings.default, 'fullscreen');
      removeArrayItem(newSettings.left, 'fullscreen');
      removeArrayItem(newSettings.right, 'fullscreen');
    }

    removeArrayItem(newSettings.default, 'hd-indicator');
    removeArrayItem(newSettings.left, 'hd-indicator');

    if (this.core.activePlayback.name === 'html5_video') {
      newSettings.seekEnabled = this.isSeekEnabledForHtml5Playback();
    }

    const settingsChanged = JSON.stringify(this.settings) !== JSON.stringify(newSettings);

    if (settingsChanged) {
      this.settings = newSettings;
      this.render();
    }
  }

  getSettings() {
    // TODO show live and remove duration/position if live
    return $.extend(true, {}, this.container && this.container.settings);
  }

  highDefinitionUpdate(isHD: boolean) {
    this.isHD = isHD;
  }

  createCachedElements() {
    const $layer = this.$el.find('.media-control-layer');

    this.$duration = $layer.find('.media-control-indicator[data-duration]');
    this.$fullscreenToggle = $layer.find('button.media-control-button[data-fullscreen]');
    this.$playPauseToggle = $layer.find('button.media-control-button[data-playpause]');
    this.$playStopToggle = $layer.find('button.media-control-button[data-playstop]');
    this.$position = $layer.find('.media-control-indicator[data-position]');
    this.$seekBarContainer = $layer.find('.bar-container[data-seekbar]');
    this.$seekBarLoaded = $layer.find('.bar-fill-1[data-seekbar]');
    this.$seekBarPosition = $layer.find('.bar-fill-2[data-seekbar]');
    this.$seekBarScrubber = $layer.find('.bar-scrubber[data-seekbar]');
    this.$seekBarHover = $layer.find('.bar-hover[data-seekbar]');
    this.$volumeBarContainer = $layer.find('.bar-container[data-volume]');
    this.$volumeContainer = $layer.find('.drawer-container[data-volume]');
    this.$volumeIcon = $layer.find('.drawer-icon[data-volume]');
    this.$volumeBarBackground = this.$el.find('.bar-background[data-volume]');
    this.$volumeBarFill = this.$el.find('.bar-fill-1[data-volume]');
    this.$volumeBarScrubber = this.$el.find('.bar-scrubber[data-volume]');
    this.$bottomGear = this.$el.find('.media-control-bottomgear');
    this.$pip = this.$el.find('.media-control-pip');
    this.$audioTracksSelector = this.$el.find('.media-control-audio-tracks[data-audiotracks]');
    this.$subtitlesSelector = this.$el.find('.media-control-subtitles[data-subtitles]');
    this.$playbackRate = this.$el.find('.media-control-playbackrate[data-playbackrate]');
    this.$multiCameraSelector = this.$el.find('.media-control-multicamera[data-multicamera]');
    this.$clipText = this.$el.find('.media-clip-text[data-clipstext]');
    this.$clipTextContainer = this.$el.find('.media-clip-container[data-clipstext]');

    this.resetIndicators();
    this.initializeIcons();
  }

  getElement(name: MediaControlElement): ZeptoResult | null {
    switch (name) {
      case 'pip':
        return this.$pip;
    }
    return null;
  }

  resetIndicators() {
    assert.ok(this.$duration && this.$position, 'duration and position elements must be present');
    this.displayedPosition = (this.$position.text as () => string)();
    this.displayedDuration = (this.$duration.text as () => string)();
  }

  initializeIcons() {
    const $layer = this.$el.find('.media-control-layer');

    $layer.find('button.media-control-button[data-play]').append(playIcon);
    $layer.find('button.media-control-button[data-pause]').append(pauseIcon);
    $layer.find('button.media-control-button[data-stop]').append(stopIcon);
    this.$playPauseToggle?.append(playIcon);
    this.$playStopToggle?.append(playIcon);
    this.$volumeIcon?.append(volumeMaxIcon);
    this.$fullscreenToggle?.append(fullscreenOffIcon);
  }

  setSeekPercentage(value: number) {
    value = Math.max(Math.min(value, 100.0), 0);
    // not changed since last update
    if (this.displayedSeekBarPercentage === value) {
      return;
    }

    this.displayedSeekBarPercentage = value;

    // assert.ok(this.$seekBarPosition && this.$seekBarScrubber, 'seek bar elements must be present');
    this.$seekBarPosition?.removeClass('media-control-notransition');
    this.$seekBarScrubber?.removeClass('media-control-notransition');
    this.$seekBarPosition?.css({ width: `${value}%` });
    this.$seekBarScrubber?.css({ left: `${value}%` });
  }

  seekRelative(delta: number) {
    if (!this.settings.seekEnabled) {
      return;
    }

    const currentTime = this.container.getCurrentTime();
    const duration = this.container.getDuration();
    let position = Math.min(Math.max(currentTime + delta, 0), duration);

    position = Math.min(position * 100 / duration, 100);
    this.container.seekPercentage(position);
  }

  bindKeyAndShow(key: string, callback: () => boolean | undefined) { // TODO or boolean return type
    this.kibo.down(key, () => {
      this.show();

      return callback();
    });
  }

  bindKeyEvents() {
    if (Browser.isMobile || this.options.disableKeyboardShortcuts) {
      return;
    }

    this.unbindKeyEvents();
    this.kibo = new Kibo(this.options.focusElement || this.options.parentElement);
    this.bindKeyAndShow('space', () => this.togglePlayPause());
    this.bindKeyAndShow('left', () => {
      this.seekRelative(-5);
      return true;
    });
    this.bindKeyAndShow('right', () => {
      this.seekRelative(5);
      return true;
    });
    this.bindKeyAndShow('shift left', () => {
      this.seekRelative(-10);
      return true;
    });
    this.bindKeyAndShow('shift right', () => {
      this.seekRelative(10);
      return true;
    });
    this.bindKeyAndShow('shift ctrl left', () => {
      this.seekRelative(-15);
      return true;
    });
    this.bindKeyAndShow('shift ctrl right', () => {
      this.seekRelative(15);
      return true;
    });
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

    keys.forEach((i) => {
      this.bindKeyAndShow(i, () => {
        this.settings.seekEnabled && this.container && this.container.seekPercentage(Number(i) * 10);
        return false;
      });
    });
  }

  unbindKeyEvents() {
    if (this.kibo) {
      this.kibo.off('space');
      this.kibo.off('left');
      this.kibo.off('right');
      this.kibo.off('shift left');
      this.kibo.off('shift right');
      this.kibo.off('shift ctrl left');
      this.kibo.off('shift ctrl right');
      this.kibo.off(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    }
  }

  parseColors() {
    const design = this.options.design || {};

    let variables: string[] = [];

    if (!template) {
      return;
    }

    // TODO camel case
    if (design.background_color) {
      variables = variables.concat([
        `--theme-background-color: ${design.background_color};`
      ]);
    }

    if (design.text_color) {
      variables = variables.concat([
        `--theme-text-color: ${design.text_color};`
      ]);
    }

    if (design.foreground_color) {
      variables = variables.concat([
        `--theme-foreground-color: ${design.foreground_color};`
      ]);
    }

    if (design.hover_color) {
      variables = variables.concat([
        `--theme-hover-color: ${design.hover_color};`
      ]);
    }

    this.$el.append(`<style>:root {${variables.join('\n')}}</style>`);
  }

  applyButtonStyle(element: ZeptoResult | undefined) {
    this.buttonsColor
      && element
      && $(element).find('svg path').css({ 'fill': this.buttonsColor });
  }

  destroy() {
    $(document).unbind('mouseup', this.stopDrag);
    $(document).unbind('mousemove', this.updateDrag);
    this.unbindKeyEvents();
    // @ts-ignore
    this.stopListening();
    return super.destroy();
  }

  configure() {
    this.advertisementPlaying ? this.disable() : this.enable();
    this.trigger(Events.MEDIACONTROL_OPTIONS_CHANGE);
  }

  render() {
    const timeout = this.options.hideMediaControlDelay || 2000;

    const html = this.template({ settings: this.settings ?? {} });
    this.$el.html(html);
    // const style = Styler.getStyleFor(mediaControlStyle, { baseUrl: this.options.baseUrl });
    // this.$el.append(style[0]);
    this.createCachedElements();

    this.drawDurationAndPosition();

    this.$playPauseToggle?.addClass('paused');
    this.$playStopToggle?.addClass('stopped');

    this.changeTogglePlay();

    if (this.container) {
      this.hideId = setTimeout(() => this.hide(), timeout);
      this.disabled && this.hide();
    }

    // Video volume cannot be changed with Safari on mobile devices
    // Display mute/unmute icon only if Safari version >= 10
    if (Browser.isSafari && Browser.isMobile) {
      if (Browser.version < 10) {
        this.$volumeContainer?.css({ 'display': 'none' });
      } else {
        this.$volumeBarContainer?.css({ 'display': 'none' });
      }
    }

    this.$seekBarPosition?.addClass('media-control-notransition');
    this.$seekBarScrubber?.addClass('media-control-notransition');

    let previousSeekPercentage = 0;

    if (this.displayedSeekBarPercentage) {
      previousSeekPercentage = this.displayedSeekBarPercentage;
    }

    this.displayedSeekBarPercentage = null;
    this.setSeekPercentage(previousSeekPercentage);

    setTimeout(() => {
      !this.settings.seekEnabled && this.$seekBarContainer?.addClass('seek-disabled');
      !Browser.isMobile && !this.options.disableKeyboardShortcuts && this.bindKeyEvents();
      this.playerResize({ width: this.options.width, height: this.options.height });
      this.hideVolumeBar(0);
    }, 0);

    this.parseColors();
    this.highDefinitionUpdate(this.isHD);

    this.core.$el.append(this.el);

    this.rendered = true;
    this.updateVolumeUI();
    this.trigger(Events.MEDIACONTROL_RENDERED);

    return this;
  }

  get bigPlayButton() {
    return playIcon;
  }

  private handleFullScreenOnBtn() {
    this.trigger(Events.MEDIACONTROL_FULLSCREEN, this.name);
    this.container.fullscreen();
    // TODO: fix after it full screen will be fixed on iOS
    if (Browser.isiOS) {
      if (this.core.isFullscreen()) {
        Fullscreen.cancelFullscreen(this.core.el);
      } else {
        Fullscreen.requestFullscreen(this.core.el);
      }
    } else {
      this.core.toggleFullscreen();
    }
    this.resetUserKeepVisible();
  }

  onStartAd() {
    this.advertisementPlaying = true;
    this.disable();
  }

  onFinishAd() {
    this.advertisementPlaying = false;
    this.enable();
  }

  setClipText(txt: unknown) {
    if (this.$clipText && txt) {
      this.$clipTextContainer?.show();
      this.$clipText.text(`${txt}`);
    }
  }

  hideControllAds() {
    if (this.container.advertisement && this.container.advertisement.type !== 'idle') {
      this.hide();
    }
  }

  setSVGMask(svg: string) {
    if (this.svgMask) {
      this.svgMask.remove();
    }

    if (this.$seekBarContainer?.get(0)) {
      this.$seekBarContainer.addClass('clips');
    }

    this.svgMask = $(svg);
    this.$seekBarContainer?.append(this.svgMask);
  }

  // https://bugs.chromium.org/p/chromium/issues/detail?id=109212
  setMuted(value: boolean) {
    this.container.options.mute = value;
  }

  private static getPageX(event: MouseEvent | TouchEvent): number {
    return getPageX(event);
  }

  private static getPageY(event: MouseEvent | TouchEvent): number {
    if ((event as MouseEvent).pageY) {
      return (event as MouseEvent).pageY;
    }

    if ((event as TouchEvent).changedTouches) {
      return (event as TouchEvent).changedTouches[(event as TouchEvent).changedTouches.length - 1].pageY;
    }

    return 0;
  }

  //Решают проблему, когда нам не нужно, чтобы с помощью контролов человек мог запускать
  // или останавливать поток, контролы, которыми он управляет не должны работать
  enableControlButton() {
    this.disabledClickableList.forEach((element) => {
      element.el.css({ 'pointer-events': element.pointerEventValue });
    });
  }

  disabledControlButton() {
    this.disabledClickableList.forEach((element) => {
      element.el.css({ 'pointer-events': 'none' });
    });
  }

  isSeekEnabledForHtml5Playback() {
    if (this.core.getPlaybackType() === Playback.LIVE) {
      return this.options.dvrEnabled;
    }

    return isFinite(this.core.activePlayback.getDuration());
  }
}

// TODO drop?
MediaControl.extend = function (properties) {
  return extend(MediaControl, properties);
};
