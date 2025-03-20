// This is a derived work from the {@link https://github.com/clappr/clappr-plugins/tree/ffaa9d27005fa5a8a7c243ffc47eb5655b84b371/src/plugins/media_control | Clappr MediaControl plugin}
// It is redistributed under the terms of the {@link ../../../../../LICENSE | Apache 2.0} license.
// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the {@link https://github.com/clappr/clappr-plugins/blob/master/LICENSE | LICENSE}.

import assert from 'assert'
import {
  Events,
  UICorePlugin,
  Browser,
  Playback,
  Utils,
  template,
  $,
  Core,
} from '@clappr/core'
import { reportError, trace } from '@gcorevideo/utils'

import { type TimeProgress } from '../../playback.types.js'

// TODO replace Kibo with mousetrap
import { Kibo } from '../kibo/index.js'

import { CLAPPR_VERSION } from '../../build.js'
import { ZeptoResult } from '../../types.js'
import { getPageX } from '../utils.js'
import { fullscreenEnabled, isFullscreen } from '../utils/fullscreen.js'

import '../../../assets/media-control/media-control.scss'

import mediaControlHTML from '../../../assets/media-control/media-control.ejs'
import playIcon from '../../../assets/icons/new/play.svg'
import pauseIcon from '../../../assets/icons/new/pause.svg'
import stopIcon from '../../../assets/icons/new/stop.svg'
import volumeMaxIcon from '../../../assets/icons/new/volume-max.svg'
import volumeOffIcon from '../../../assets/icons/new/volume-off.svg'
import fullscreenOffIcon from '../../../assets/icons/new/fullscreen-off.svg'
import fullscreenOnIcon from '../../../assets/icons/new/fullscreen-on.svg'

/**
 * Media control elements that appear in the left area.
 * @beta
 */
export type MediaControlLeftElement =
  | 'clipText' // TODO lowercase
  | 'duration'
  | 'dvr'
  | 'playpause'
  | 'playstop'
  | 'position'
  | 'volume'
  | 'clips'

/**
 * Media control elements that appear in main layer, spanning the entire width of the player.
 * @beta
 */
export type MediaControlLayerElement = 'seekbar' | 'seekBarContainer' // TODO rename seekbar

/**
 * Media control elements that appear in the right area.
 * @beta
 */
export type MediaControlRightElement =
  | 'audiotracks'
  | 'cc'
  | 'fullscreen'
  | 'hd-indicator'
  | 'gear'
  | 'multicamera'
  | 'pip'
  | 'vr'

/**
 * Built-in media control elements.
 * @beta
 */
export type MediaControlElement =
  | MediaControlLeftElement
  | MediaControlLayerElement
  | MediaControlRightElement

const MANAGED_ELEMENTS: MediaControlElement[] = [
  'dvr',
  'duration',
  'fullscreen',
  'hd-indicator',
  'position',
  'seekbar',
  'volume',
]

/**
 * Specifies the allowed media control elements in each area.
 * Can be used to restrict rendered media control elements.
 * @beta
 */
export type MediaControlSettings = {
  left: MediaControlLeftElement[]
  right: MediaControlRightElement[]
  default: MediaControlLayerElement[]
  seekEnabled: boolean
}

const DEFAULT_SETTINGS: MediaControlSettings = {
  default: [],
  left: ['dvr'],
  right: [
    'audiotracks',
    'cc',
    'fullscreen',
    'gear',
    'multicamera',
    'pip',
    'vr',
  ],
  seekEnabled: true,
}

const INITIAL_SETTINGS: MediaControlSettings = {
  left: [],
  right: [],
  default: [],
  seekEnabled: false,
}

const T = 'plugins.media_control'

const LEFT_ORDER = [
  'playpause',
  'playstop',
  'volume',
  'position',
  'duration',
  'dvr',
]

const { Config, Fullscreen, formatTime, extend, removeArrayItem } = Utils

function orderByOrderPattern(arr: string[], order: string[]): string[] {
  const arrWithoutDuplicates = [...new Set(arr)]
  const ordered = order.filter((item) => arrWithoutDuplicates.includes(item))

  const rest = arrWithoutDuplicates.filter((item) => !order.includes(item))

  return [...ordered, ...rest]
}

type DisabledClickable = {
  el: ZeptoResult
  pointerEventValue: string
}

/**
 * `PLUGIN` that provides basic playback controls UI and a foundation for developing custom UI.
 * @beta
 * @remarks
 * The methods exposed are to be used by the other plugins that extend the media control UI.
 *
 * Configuration options:
 *
 * - `mediaControl`: {@link MediaControlSettings} - specifies the allowed media control elements in each area
 *
 * - `persistConfig`: boolean - `common` option, makes the plugin persist the media control settings
 *
 * - `chromeless`: boolean
 */
export class MediaControl extends UICorePlugin {
  // private advertisementPlaying = false

  private buttonsColor: string | null = null

  private currentDurationValue: number = 0
  private currentPositionValue: number = 0
  private currentSeekBarPercentage = 0

  private disabledClickableList: DisabledClickable[] = []
  private displayedDuration: string | null = null
  private displayedPosition: string | null = null
  private displayedSeekBarPercentage: number | null = null

  private draggingSeekBar = false
  private draggingVolumeBar = false

  private fullScreenOnVideoTagSupported = false

  private hideId: ReturnType<typeof setTimeout> | null = null
  private hideVolumeId: ReturnType<typeof setTimeout> | null = null

  private intendedVolume = 100

  private keepVisible = false

  private kibo: Kibo

  private lastMouseX = 0
  private lastMouseY = 0

  private metadataLoaded = false

  private hasUpdate = false

  private persistConfig: boolean

  private renderTimerId: ReturnType<typeof setTimeout> | null = null

  private rendered = false

  private settings: MediaControlSettings = INITIAL_SETTINGS

  private userDisabled = false

  private userKeepVisible = false

  private verticalVolume = false

  private $duration: ZeptoResult | null = null

  private $fullscreenToggle: ZeptoResult | null = null

  private $multiCameraSelector: ZeptoResult | null = null

  private $playPauseToggle: ZeptoResult | null = null

  private $playStopToggle: ZeptoResult | null = null

  private $position: ZeptoResult | null = null

  private $seekBarContainer: ZeptoResult | null = null

  private $seekBarHover: ZeptoResult | null = null

  private $seekBarLoaded: ZeptoResult | null = null

  private $seekBarPosition: ZeptoResult | null = null

  private $seekBarScrubber: ZeptoResult | null = null

  private $volumeBarContainer: ZeptoResult | null = null

  private $volumeBarBackground: ZeptoResult | null = null

  private $volumeBarFill: ZeptoResult | null = null

  private $volumeBarScrubber: ZeptoResult | null = null

  private $volumeContainer: ZeptoResult | null = null

  private $volumeIcon: ZeptoResult | null = null

  private static readonly template = template(mediaControlHTML)

  /**
   * @internal
   */
  get name() {
    return 'media_control'
  }

  /**
   * @internal
   */
  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  private get disabled() {
    const playbackIsNOOP =
      this.core.activeContainer &&
      this.core.activeContainer.getPlaybackType() === Playback.NO_OP

    return this.userDisabled || playbackIsNOOP
  }

  /**
   * @internal
   * @deprecated Use core.activeContainer directly
   */
  get container() {
    return this.core.activeContainer
  }

  /**
   * @internal
   * @deprecated Use core.activePlayback directly
   */
  get playback() {
    return this.core.activePlayback
  }

  /**
   * @internal
   */
  override get attributes() {
    return {
      class: 'media-control-skin-1',
      'data-media-control-skin-1': '',
    }
  }

  /**
   * @internal
   */
  override get events() {
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
      'mouseleave .media-control-layer[data-controls]': 'resetUserKeepVisible',
    }
  }

  get currentSeekPos() {
    return this.currentSeekBarPercentage
  }

  /**
   * Current volume [0..100]
   */
  get volume(): number {
    return this.core.activeContainer?.isReady
      ? this.core.activeContainer.volume
      : this.intendedVolume
  }

  /**
   * Muted state
   */
  get muted() {
    return this.volume === 0
  }

  constructor(core: Core) {
    super(core)
    this.persistConfig = this.options.persistConfig

    this.setInitialVolume()

    this.kibo = new Kibo(this.options.focusElement)
    this.bindKeyEvents()

    this.userDisabled = false
    if (this.options.chromeless) {
      this.disable()
    }

    $(document).bind('mouseup', this.stopDrag)
    $(document).bind('mousemove', this.updateDrag)

    $(document).bind('touchend', this.stopDrag)
    $(document).bind('touchmove', this.updateDrag)
  }

  /**
   * @internal
   */
  override getExternalInterface() {
    return {
      setVolume: this.setVolume,
      getVolume: () => this.volume,
    }
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.onActiveContainerChanged,
    )
    this.listenTo(this.core, Events.CORE_MOUSE_MOVE, this.show)
    this.listenTo(this.core, Events.CORE_MOUSE_LEAVE, () =>
      this.hide(this.options.hideMediaControlDelay),
    )
    this.listenTo(this.core, Events.CORE_FULLSCREEN, this.show)
    this.listenTo(this.core, Events.CORE_OPTIONS_CHANGE, this.configure)
    this.listenTo(this.core, Events.CORE_RESIZE, this.playerResize)

    this.listenTo(this.core, 'core:advertisement:start', this.onStartAd)
    this.listenTo(this.core, 'core:advertisement:finish', this.onFinishAd)

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

  private bindContainerEvents() {
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_PLAY,
      this.changeTogglePlay,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_PAUSE,
      this.changeTogglePlay,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_STOP,
      this.changeTogglePlay,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_DBLCLICK,
      this.toggleFullscreen,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_TIMEUPDATE,
      this.onTimeUpdate,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_PROGRESS,
      this.updateProgressBar,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_SETTINGSUPDATE,
      this.updateSettings,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_PLAYBACKDVRSTATECHANGED,
      this.onDvrStateChanged,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_HIGHDEFINITIONUPDATE,
      this.onHdUpdate,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_MEDIACONTROL_DISABLE,
      this.disable,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_MEDIACONTROL_ENABLE,
      this.enable,
    )
    this.listenTo(this.core.activeContainer, Events.CONTAINER_ENDED, this.ended)
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_VOLUME,
      this.onVolumeChanged,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_OPTIONS_CHANGE,
      this.setInitialVolume,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_LOADEDMETADATA,
      this.onLoadedMetadata,
    )
    this.listenTo(this.core, Events.CONTAINER_DESTROYED, () => {
      this.cancelRenderTimer()
    })
  }

  /**
   * Hides the media control UI
   */
  override disable() {
    trace(`${T} disable`)
    this.userDisabled = true // TODO distinguish between user and system (e.g., unplayable) disabled?
    this.hide()
    this.unbindKeyEvents()
    this.$el.hide() // TODO why?
  }

  /**
   * Reenables the plugin disabled earlier with the {@link MediaControl.disable} method
   */
  override enable() {
    trace(`${T} enable`)
    if (this.options.chromeless) {
      return
    }
    this.userDisabled = false
    this.bindKeyEvents()
    this.show()
  }

  /**
   * Set the initial volume, which is preserved when playback is interrupted by an advertisement
   */
  setInitialVolume() {
    const initialVolume = this.persistConfig ? Config.restore('volume') : 100
    const options = (this.container && this.container.options) || this.options

    this.setVolume(options.mute ? 0 : initialVolume, true)
  }

  private onVolumeChanged() {
    this.updateVolumeUI()
  }

  private onLoadedMetadata() {
    const video = this.core.activePlayback?.el

    // video.webkitSupportsFullscreen is deprecated but iOS appears to only use this
    // see https://github.com/clappr/clappr/issues/1127
    if (!fullscreenEnabled() && video.webkitSupportsFullscreen) {
      // TODO sort out, use single utility function
      this.fullScreenOnVideoTagSupported = true
    }
    this.renderTimerId = setTimeout(() => {
      this.renderTimerId = null
      this.metadataLoaded = true
      this.render()
      if (this.core.activeContainer.getPlaybackType() === Playback.LIVE) {
        this.$el.addClass('live')
      } else {
        this.$el.removeClass('live')
      }
    }, 25)
  }

  private updateVolumeUI() {
    // this will be called after a render
    if (!this.rendered) {
      return
    }

    assert.ok(this.$volumeBarContainer, 'volume bar container must be present')
    const containerWidth = this.$volumeBarContainer.width()

    assert.ok(
      this.$volumeBarBackground,
      'volume bar background must be present',
    )
    const barWidth = this.$volumeBarBackground.width()
    const offset = (containerWidth - barWidth) / 2.0
    const pos = (barWidth * this.volume) / 100.0 + offset

    assert.ok(this.$volumeBarFill, 'volume bar fill must be present')
    this.$volumeBarFill.css({ width: `${this.volume}%` })
    this.$volumeBarFill.css({ width: `${this.volume}%` })

    assert.ok(this.$volumeBarScrubber, 'volume bar scrubber must be present')
    this.$volumeBarScrubber.css({ left: pos })

    // update volume bar segments on segmented bar mode
    this.$volumeBarContainer.find('.segmented-bar-element').removeClass('fill')
    const item = Math.ceil(this.volume / 10.0)

    this.$volumeBarContainer
      .find('.segmented-bar-element')
      .slice(0, item)
      .addClass('fill')
    assert.ok(this.$volumeIcon, 'volume icon must be present')
    this.$volumeIcon.html('')
    this.$volumeIcon.removeClass('muted')
    if (!this.muted) {
      this.$volumeIcon.append(volumeMaxIcon)
    } else {
      this.$volumeIcon.append(volumeOffIcon)
      this.$volumeIcon.addClass('muted')
    }
    this.applyButtonStyle(this.$volumeIcon)

    this.$volumeBarScrubber.css({ left: `${this.volume}%` })
    this.$volumeIcon.html('')
    this.$volumeIcon.removeClass('muted')

    if (!this.muted) {
      this.$volumeIcon.append(volumeMaxIcon)
    } else {
      this.$volumeIcon.append(volumeOffIcon)
      this.$volumeIcon.addClass('muted')
    }
    this.applyButtonStyle(this.$volumeIcon)
  }

  private changeTogglePlay() {
    // assert.ok(this.$playPauseToggle, 'play/pause toggle must be present');
    this.$playPauseToggle?.html('')

    // assert.ok(this.$playStopToggle, 'play/stop toggle must be present');
    this.$playStopToggle?.html('')
    if (this.container && this.container.isPlaying()) {
      this.$playPauseToggle?.append(pauseIcon)
      this.$playStopToggle?.append(pauseIcon)
      this.trigger(Events.MEDIACONTROL_PLAYING)
    } else {
      this.$playPauseToggle?.append(playIcon)
      this.$playStopToggle?.append(playIcon)
      this.trigger(Events.MEDIACONTROL_NOTPLAYING)
      if (Browser.isMobile) {
        this.show()
      }
    }
    this.applyButtonStyle(this.$playPauseToggle)
    this.applyButtonStyle(this.$playStopToggle)
  }

  private mousemoveOnSeekBar(event: MouseEvent) {
    if (this.settings.seekEnabled) {
      // assert.ok(this.$seekBarHover && this.$seekBarContainer, 'seek bar elements must be present');
      if (this.$seekBarHover && this.$seekBarContainer) {
        const offsetX =
          MediaControl.getPageX(event) -
          this.$seekBarContainer.offset().left -
          this.$seekBarHover.width() / 2

        this.$seekBarHover.css({ left: offsetX })
      }
    }
    this.trigger(Events.MEDIACONTROL_MOUSEMOVE_SEEKBAR, event)
  }

  private mouseleaveOnSeekBar(event: MouseEvent) {
    this.trigger(Events.MEDIACONTROL_MOUSELEAVE_SEEKBAR, event)
  }

  private onVolumeClick(event: MouseEvent) {
    this.setVolume(this.getVolumeFromUIEvent(event))
  }

  private mousemoveOnVolumeBar(event: MouseEvent) {
    this.draggingVolumeBar && this.setVolume(this.getVolumeFromUIEvent(event))
  }

  private playerResize(size: { width: number; height: number }) {
    if (this.container.el) {
      if (isFullscreen(this.container.el)) {
        this.$fullscreenToggle?.html(fullscreenOnIcon)
      } else {
        this.$fullscreenToggle?.html(fullscreenOffIcon)
      }
    }

    this.applyButtonStyle(this.$fullscreenToggle)
    this.$el.removeClass('w370')
    this.$el.removeClass('w270')
    this.verticalVolume = false
    try {
      const skinWidth = this.container.$el.width() || size.width

      if (skinWidth <= 370 || this.options.hideVolumeBar) {
        this.$el.addClass('w370')
      }

      if (skinWidth <= 270 && !Browser.isMobile) {
        this.verticalVolume = true
        this.$el.addClass('w270')
      }
    } catch (e) {
      reportError(e)
    }
  }

  private togglePlayPause() {
    this.container.isPlaying() ? this.container.pause() : this.container.play()

    return false
  }

  private togglePlayStop() {
    this.container.isPlaying() ? this.container.stop() : this.container.play()
  }

  private startSeekDrag(event: MouseEvent) {
    if (!this.settings.seekEnabled) {
      return
    }
    this.draggingSeekBar = true
    this.$el.addClass('dragging')

    // assert.ok(this.$seekBarLoaded && this.$seekBarPosition && this.$seekBarScrubber, 'seek bar elements must be present');
    this.$seekBarLoaded?.addClass('media-control-notransition')
    this.$seekBarPosition?.addClass('media-control-notransition')
    this.$seekBarScrubber?.addClass('media-control-notransition')
    event && event.preventDefault()
  }

  private startVolumeDrag(event: MouseEvent) {
    this.draggingVolumeBar = true
    this.$el.addClass('dragging')
    event && event.preventDefault()
  }

  private stopDrag = (event: MouseEvent) => {
    this.draggingSeekBar && this.seek(event)
    this.$el.removeClass('dragging')
    this.$seekBarLoaded?.removeClass('media-control-notransition')
    this.$seekBarPosition?.removeClass('media-control-notransition')
    this.$seekBarScrubber?.removeClass('media-control-notransition dragging')
    this.draggingSeekBar = false
    this.draggingVolumeBar = false
  }

  private updateDrag = (event: MouseEvent | TouchEvent) => {
    if (this.draggingSeekBar) {
      event.preventDefault()
      const pageX = MediaControl.getPageX(event)

      assert.ok(this.$seekBarContainer, 'seek bar container must be present')
      const offsetX = pageX - this.$seekBarContainer.offset().left
      let pos = (offsetX / this.$seekBarContainer.width()) * 100

      pos = Math.min(100, Math.max(pos, 0))

      this.setSeekPercentage(pos)
    } else if (this.draggingVolumeBar) {
      event.preventDefault()
      this.setVolume(this.getVolumeFromUIEvent(event))
    }
  }

  private getVolumeFromUIEvent(event: MouseEvent | TouchEvent) {
    let volumeFromUI = 0

    assert.ok(this.$volumeBarContainer, 'volume bar container must be present')
    if (!this.verticalVolume) {
      const offsetY =
        MediaControl.getPageX(event) - this.$volumeBarContainer.offset().left

      volumeFromUI = (offsetY / this.$volumeBarContainer.width()) * 100
    } else {
      const offsetX =
        80 -
        Math.abs(
          this.$volumeBarContainer.offset().top - MediaControl.getPageY(event),
        )

      volumeFromUI = (offsetX / this.$volumeBarContainer.height()) * 100
    }

    return volumeFromUI
  }

  private toggleMute() {
    this.setVolume(this.muted ? 100 : 0)
  }

  /**
   * Set the volume
   * @param value - The volume value
   * @param isInitialVolume - save as the initial volume
   * @remarks
   * Initial volume can be restored later
   */
  setVolume(value: number, isInitialVolume = false) {
    value = Math.min(100, Math.max(value, 0))
    // this will hold the intended volume
    // it may not actually get set to this straight away
    // if the container is not ready etc
    this.intendedVolume = value
    this.persistConfig && !isInitialVolume && Config.persist('volume', value)
    // TODO
    const setWhenContainerReady = () => {
      if (this.core.activeContainer && this.core.activeContainer.isReady) {
        this.core.activeContainer.setVolume(value)
      } else {
        this.listenToOnce(
          this.core.activeContainer,
          Events.CONTAINER_READY,
          () => {
            this.core.activeContainer.setVolume(value)
          },
        )
      }
    }

    if (!this.core.activeContainer) {
      this.listenToOnce(this, Events.MEDIACONTROL_CONTAINERCHANGED, () =>
        setWhenContainerReady(),
      )
    } else {
      setWhenContainerReady()
    }
  }

  private toggleFullscreen() {
    if (!Browser.isMobile) {
      this.trigger(Events.MEDIACONTROL_FULLSCREEN, this.name)
      this.core.activeContainer.fullscreen()
      this.core.toggleFullscreen()
      this.resetUserKeepVisible()
    }
  }

  private onActiveContainerChanged() {
    this.fullScreenOnVideoTagSupported = false
    this.metadataLoaded = false
    // set the new container to match the volume of the last one
    this.setInitialVolume()
    this.changeTogglePlay()
    this.bindContainerEvents()
    // TODO remove?
    this.updateSettings()
    // TODO test, figure out if this is needed
    if (this.core.activeContainer.mediaControlDisabled) {
      this.disable()
    } else {
      this.enable()
    }
    this.trigger(Events.MEDIACONTROL_CONTAINERCHANGED) // TODO figure out

    if (this.core.activeContainer.$el) {
      this.core.activeContainer.$el.addClass('container-skin-1')
    }

    if (this.options.cropVideo) {
      this.core.activeContainer.$el.addClass('crop-video')
    }

    // TODO handle by the spinner itself
    const spinnerPlugin = this.core.activeContainer.getPlugin('spinner')

    spinnerPlugin?.$el.find('div').addClass('gcore-skin-main-color')

    // TODO handle by the seek_time itself
    const seekTimePlugin = this.container.getPlugin('seek_time')

    seekTimePlugin?.$el.addClass('gcore-skin-bg-color')
    seekTimePlugin?.$el.find('span').addClass('gcore-skin-text-color')
  }

  private showVolumeBar() {
    if (this.hideVolumeId) {
      clearTimeout(this.hideVolumeId)
    }
    this.$volumeBarContainer?.removeClass('volume-bar-hide')
  }

  private hideVolumeBar(timeout = 400) {
    if (!this.$volumeBarContainer) {
      return
    }
    if (this.hideVolumeId) {
      clearTimeout(this.hideVolumeId)
    }
    if (this.draggingVolumeBar) {
      this.hideVolumeId = setTimeout(() => this.hideVolumeBar(), timeout)
    } else {
      this.hideVolumeId = setTimeout(
        () => this.$volumeBarContainer?.addClass('volume-bar-hide'),
        timeout,
      )
    }
  }

  private ended() {
    this.changeTogglePlay()
  }

  private updateProgressBar(progress: TimeProgress) {
    const loadedStart = (progress.start / progress.total) * 100
    const loadedEnd = (progress.current / progress.total) * 100

    this.$seekBarLoaded?.css({
      left: `${loadedStart}%`,
      width: `${loadedEnd - loadedStart}%`,
    })
  }

  private onTimeUpdate(timeProgress: TimeProgress) {
    if (this.draggingSeekBar) {
      return
    }
    // TODO why should current time ever be negative?
    const position =
      timeProgress.current < 0 ? timeProgress.total : timeProgress.current

    this.currentPositionValue = position
    this.currentDurationValue = timeProgress.total

    if (!this.draggingSeekBar) {
      this.renderSeekBar()
    }
  }

  private renderSeekBar() {
    // this will be triggered as soon as these become available
    if (
      this.currentPositionValue === null ||
      this.currentDurationValue === null
    ) {
      return
    }

    // default to 100%
    this.currentSeekBarPercentage = 100
    if (
      this.core.activeContainer &&
      (this.core.activeContainer.getPlaybackType() !== Playback.LIVE ||
        this.core.activeContainer.isDvrInUse())
    ) {
      this.currentSeekBarPercentage =
        (this.currentPositionValue / this.currentDurationValue) * 100
    }

    this.setSeekPercentage(this.currentSeekBarPercentage)

    this.drawDurationAndPosition()
  }

  private drawDurationAndPosition() {
    const newPosition = formatTime(this.currentPositionValue)
    const newDuration = formatTime(this.currentDurationValue)

    if (newPosition !== this.displayedPosition) {
      this.$position?.text(newPosition)
      this.displayedPosition = newPosition
    }
    if (newDuration !== this.displayedDuration) {
      this.$duration?.text(newDuration)
      this.displayedDuration = newDuration
    }
  }

  private seek(event: MouseEvent) {
    if (!this.settings.seekEnabled) {
      return
    }

    assert.ok(this.$seekBarContainer, 'seek bar container must be present')
    const offsetX =
      MediaControl.getPageX(event) - this.$seekBarContainer.offset().left
    let pos = (offsetX / this.$seekBarContainer.width()) * 100

    pos = Math.min(100, Math.max(pos, 0))
    this.core.activeContainer && this.core.activeContainer.seekPercentage(pos)

    this.setSeekPercentage(pos)

    return false
  }

  private setUserKeepVisible() {
    this.userKeepVisible = true
  }

  private resetUserKeepVisible() {
    this.userKeepVisible = false
  }

  private isVisible() {
    return !this.$el.hasClass('media-control-hide')
  }

  private show(event?: MouseEvent) {
    if (this.disabled || this.options.disableControlPanel) {
      return
    }

    const timeout = 2000
    const mousePointerMoved =
      event &&
      event.clientX !== this.lastMouseX &&
      event.clientY !== this.lastMouseY

    if (!event || mousePointerMoved || navigator.userAgent.match(/firefox/i)) {
      if (this.hideId !== null) {
        clearTimeout(this.hideId)
        this.hideId = null
      }
      this.$el.show()
      this.trigger(Events.MEDIACONTROL_SHOW, this.name)
      this.core.activeContainer?.trigger(Events.CONTAINER_MEDIACONTROL_SHOW, this.name)
      this.$el.removeClass('media-control-hide')
      this.hideId = setTimeout(() => this.hide(), timeout)
      if (event) {
        this.lastMouseX = event.clientX
        this.lastMouseY = event.clientY
      }
    }
    const showing = true

    this.updateCursorStyle(showing)
  }

  private hide(delay = 0) {
    if (!this.isVisible()) {
      return
    }

    const timeout = delay || 2000

    if (this.hideId !== null) {
      clearTimeout(this.hideId)
    }

    if (!this.disabled && this.options.hideMediaControl === false) {
      return
    }

    const hasKeepVisibleRequested = this.userKeepVisible || this.keepVisible
    const hasDraggingAction = this.draggingSeekBar || this.draggingVolumeBar

    if (
      !this.disabled &&
      (delay || hasKeepVisibleRequested || hasDraggingAction)
    ) {
      this.hideId = setTimeout(() => this.hide(), timeout)
    } else {
      if (!this.options.controlsDontHide || isFullscreen(this.container.el)) {
        this.trigger(Events.MEDIACONTROL_HIDE, this.name)
        this.$el.addClass('media-control-hide')
        this.hideVolumeBar(0)
        const showing = false

        this.updateCursorStyle(showing)
      }
    }
  }

  private updateCursorStyle(showing: boolean) {
    if (showing) {
      this.core.$el.removeClass('nocursor')
    } else if (this.core.isFullscreen()) {
      this.core.$el.addClass('nocursor')
    }
  }

  private updateSettings() {
    trace(`${T} updateSettings`, { settings: this.settings })
    const newSettings = $.extend(
      true,
      {
        left: [],
        default: [],
        right: [],
      },
      this.core.activeContainer.settings,
    )
    trace(`${T} updateSettings`, { newSettings })

    newSettings.left.push('clips') // TODO settings
    // TODO make order controlled via CSS
    newSettings.left = orderByOrderPattern(
      [...newSettings.left, 'volume', 'clips'],
      LEFT_ORDER,
    )
    if (
      this.core.activePlayback.getPlaybackType() === Playback.LIVE &&
      this.core.activePlayback.dvrEnabled
    ) {
      newSettings.left.push('dvr')
    }

    // actual order of the items appear rendered is controlled by CSS
    newSettings.right = DEFAULT_SETTINGS.right // TODO get from the options

    if (
      (!this.fullScreenOnVideoTagSupported && !fullscreenEnabled()) ||
      this.options.fullscreenDisable
    ) {
      trace(`${T} updateSettings removing fullscreen`, {
        supported: this.fullScreenOnVideoTagSupported,
        enabled: Fullscreen.fullscreenEnabled(),
        optionsDisable: this.options.fullscreenDisable,
      })
      // remove fullscreen from settings if it is not available
      removeArrayItem(newSettings.default, 'fullscreen')
      removeArrayItem(newSettings.left, 'fullscreen')
      removeArrayItem(newSettings.right, 'fullscreen')
    }

    removeArrayItem(newSettings.default, 'hd-indicator')
    removeArrayItem(newSettings.left, 'hd-indicator')

    // TODO get from container's settings
    if (this.core.activePlayback.name === 'html5_video') {
      newSettings.seekEnabled = this.isSeekEnabledForHtml5Playback()
    }

    const settingsChanged =
      serializeSettings(this.settings) !== serializeSettings(newSettings)

    if (settingsChanged) {
      this.settings = newSettings
      this.hasUpdate = true
      this.render()
    }
  }

  private onHdUpdate(isHD: boolean) {
    // TODO render?
  }

  private createCachedElements() {
    const $layer = this.$el.find('.media-control-layer')

    this.$duration = $layer.find('.media-control-indicator[data-duration]')
    this.$fullscreenToggle = $layer.find(
      'button.media-control-button[data-fullscreen]',
    )
    this.$playPauseToggle = $layer.find(
      'button.media-control-button[data-playpause]',
    )
    this.$playStopToggle = $layer.find(
      'button.media-control-button[data-playstop]',
    )
    this.$position = $layer.find('.media-control-indicator[data-position]')
    this.$seekBarContainer = $layer.find('.bar-container[data-seekbar]')
    this.$seekBarLoaded = $layer.find('.bar-fill-1[data-seekbar]')
    this.$seekBarPosition = $layer.find('.bar-fill-2[data-seekbar]')
    this.$seekBarScrubber = $layer.find('.bar-scrubber[data-seekbar]')
    this.$seekBarHover = $layer.find('.bar-hover[data-seekbar]')
    this.$volumeBarContainer = $layer.find('.bar-container[data-volume]')
    this.$volumeContainer = $layer.find('.drawer-container[data-volume]')
    this.$volumeIcon = $layer.find('.drawer-icon[data-volume]')
    this.$volumeBarBackground = this.$el.find('.bar-background[data-volume]')
    this.$volumeBarFill = this.$el.find('.bar-fill-1[data-volume]')
    this.$volumeBarScrubber = this.$el.find('.bar-scrubber[data-volume]')
    this.$multiCameraSelector = this.$el.find(
      '.media-control-multicamera[data-multicamera]',
    )
    this.resetIndicators()
    this.initializeIcons()
  }

  /**
   * Get a media control element DOM node
   * @param name - The name of the media control element
   * @returns The DOM node to render to or extend
   * @remarks
   * Use this method to render custom media control UI in a plugin
   * @example
   * ```ts
   * class MyPlugin extends UICorePlugin {
   *   override render() {
   *     this.$el.html('<div data-clips>Here we go</div>')
   *     this.core.getPlugin('media_control').mount('clips', this.$el)
   *     return this
   *   }
   * }
   * ```
   */
  mount(name: MediaControlElement, element: ZeptoResult) {
    const panel = this.getElementLocation(name)
    trace(`${T} mount`, { name, panel: !!panel })
    if (panel) {
      const current = panel.find(`[data-${name}]`)
      element.attr(`data-${name}`, '')
      // TODO test
      if (current.length) {
        if (current[0] === element[0]) {
          return
        }
        current.replaceWith(element)
      } else {
        panel.append(element)
      }
      return
    }
  }

  /**
   * @deprecated  Use {@link MediaControl.mount} instead
   * @param name
   * @param element
   */
  putElement(name: MediaControlElement, element: ZeptoResult) {
    this.mount(name, element)
  }

  /**
   * Toggle the visibility of a media control element
   * @param name - The name of the media control element
   * @param show - Visibility state
   */
  toggleElement(area: MediaControlElement, show: boolean) {
    this.$el.find(`[data-${area}]`).toggle(show)
  }

  private getRightPanel() {
    return this.$el.find('.media-control-right-panel')
  }

  private getLeftPanel() {
    return this.$el.find('.media-control-left-panel')
  }

  private getCenterPanel() {
    return this.$el.find('.media-control-center-panel')
  }

  private resetIndicators() {
    assert.ok(
      this.$duration && this.$position,
      'duration and position elements must be present',
    )
    this.displayedPosition = (this.$position.text as () => string)()
    this.displayedDuration = (this.$duration.text as () => string)()
  }

  private initializeIcons() {
    const $layer = this.$el.find('.media-control-layer')

    $layer.find('button.media-control-button[data-play]').append(playIcon)
    $layer.find('button.media-control-button[data-pause]').append(pauseIcon)
    $layer.find('button.media-control-button[data-stop]').append(stopIcon)
    this.$playPauseToggle?.append(playIcon)
    this.$playStopToggle?.append(playIcon)
    this.$volumeIcon?.append(volumeMaxIcon)
    this.$fullscreenToggle?.append(fullscreenOffIcon)
  }

  private setSeekPercentage(value: number) {
    value = Math.max(Math.min(value, 100.0), 0)
    // not changed since last update
    if (this.displayedSeekBarPercentage === value) {
      return
    }

    this.displayedSeekBarPercentage = value

    // assert.ok(this.$seekBarPosition && this.$seekBarScrubber, 'seek bar elements must be present');
    this.$seekBarPosition?.removeClass('media-control-notransition')
    this.$seekBarScrubber?.removeClass('media-control-notransition')
    this.$seekBarPosition?.css({ width: `${value}%` })
    this.$seekBarScrubber?.css({ left: `${value}%` })
  }

  private seekRelative(delta: number) {
    if (!this.settings.seekEnabled) {
      return
    }

    const currentTime = this.core.activeContainer.getCurrentTime()
    const duration = this.core.activeContainer.getDuration()
    let position = Math.min(Math.max(currentTime + delta, 0), duration)

    position = Math.min((position * 100) / duration, 100)
    this.core.activeContainer.seekPercentage(position)
  }

  private bindKeyAndShow(key: string, callback: () => boolean | undefined) {
    // TODO or boolean return type
    this.kibo.down(key, () => {
      this.show()

      return callback()
    })
  }

  private bindKeyEvents() {
    if (Browser.isMobile || this.options.disableKeyboardShortcuts) {
      return
    }

    this.unbindKeyEvents()
    this.kibo = new Kibo(
      this.options.focusElement || this.options.parentElement,
    )
    this.bindKeyAndShow('space', () => this.togglePlayPause())
    this.bindKeyAndShow('left', () => {
      this.seekRelative(-5)
      return true
    })
    this.bindKeyAndShow('right', () => {
      this.seekRelative(5)
      return true
    })
    this.bindKeyAndShow('shift left', () => {
      this.seekRelative(-10)
      return true
    })
    this.bindKeyAndShow('shift right', () => {
      this.seekRelative(10)
      return true
    })
    this.bindKeyAndShow('shift ctrl left', () => {
      this.seekRelative(-15)
      return true
    })
    this.bindKeyAndShow('shift ctrl right', () => {
      this.seekRelative(15)
      return true
    })
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

    keys.forEach((i) => {
      this.bindKeyAndShow(i, () => {
        this.settings.seekEnabled &&
          this.core.activeContainer &&
          this.core.activeContainer.seekPercentage(Number(i) * 10)
        return false
      })
    })
  }

  private unbindKeyEvents() {
    if (this.kibo) {
      this.kibo.off('space')
      this.kibo.off('left')
      this.kibo.off('right')
      this.kibo.off('shift left')
      this.kibo.off('shift right')
      this.kibo.off('shift ctrl left')
      this.kibo.off('shift ctrl right')
      this.kibo.off(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'])
    }
  }

  private parseColors() {
    const design = this.options.design || {}

    let variables: string[] = []

    // TODO camel case
    if (design.background_color) {
      variables = variables.concat([
        `--theme-background-color: ${design.background_color};`,
      ])
    }

    if (design.text_color) {
      variables = variables.concat([
        `--theme-text-color: ${design.text_color};`,
      ])
    }

    if (design.foreground_color) {
      variables = variables.concat([
        `--theme-foreground-color: ${design.foreground_color};`,
      ])
    }

    if (design.hover_color) {
      variables = variables.concat([
        `--theme-hover-color: ${design.hover_color};`,
      ])
    }

    this.$el.append(`<style>:root {${variables.join('\n')}}</style>`)
  }

  private applyButtonStyle(element: ZeptoResult | null) {
    this.buttonsColor &&
      element &&
      $(element).find('svg path').css({ fill: this.buttonsColor })
  }

  /**
   * @internal
   */
  override destroy() {
    this.cancelRenderTimer()
    $(document).unbind('mouseup', this.stopDrag)
    $(document).unbind('mousemove', this.updateDrag)
    $(document).unbind('touchend', this.stopDrag)
    $(document).unbind('touchmove', this.updateDrag)
    this.unbindKeyEvents()
    return super.destroy()
  }

  private cancelRenderTimer() {
    if (this.renderTimerId) {
      clearTimeout(this.renderTimerId)
      this.renderTimerId = null
    }
  }

  private configure() {
    this.trigger(Events.MEDIACONTROL_OPTIONS_CHANGE)
  }

  /**
   * @internal
   */
  override render() {
    trace(`${T} render`, {
      needsUpdate: this.hasUpdate,
      metadataLoaded: this.metadataLoaded,
    })
    if (!this.hasUpdate || !this.metadataLoaded) {
      return this
    }
    const timeout = this.options.hideMediaControlDelay || 2000

    this.$el.html(MediaControl.template({ settings: this.settings }))
    // const style = Styler.getStyleFor(mediaControlStyle, { baseUrl: this.options.baseUrl });
    // this.$el.append(style[0]);
    this.createCachedElements()

    this.drawDurationAndPosition()

    this.$playPauseToggle?.addClass('paused')
    this.$playStopToggle?.addClass('stopped')

    this.changeTogglePlay()

    if (this.core.activeContainer) {
      this.hideId = setTimeout(() => this.hide(), timeout)
      this.disabled && this.hide()
    }

    // Video volume cannot be changed with Safari on mobile devices
    // Display mute/unmute icon only if Safari version >= 10
    if (Browser.isSafari && Browser.isMobile) {
      if (Browser.version < 10) {
        this.$volumeContainer?.css({ display: 'none' })
      } else {
        this.$volumeBarContainer?.css({ display: 'none' })
      }
    }

    this.$seekBarPosition?.addClass('media-control-notransition')
    this.$seekBarScrubber?.addClass('media-control-notransition')

    let previousSeekPercentage = 0

    if (this.displayedSeekBarPercentage) {
      previousSeekPercentage = this.displayedSeekBarPercentage
    }

    this.displayedSeekBarPercentage = null
    this.setSeekPercentage(previousSeekPercentage)

    setTimeout(() => {
      !this.settings.seekEnabled &&
        this.$seekBarContainer?.addClass('seek-disabled')
      !Browser.isMobile &&
        !this.options.disableKeyboardShortcuts &&
        this.bindKeyEvents()
      this.playerResize({
        width: this.options.width,
        height: this.options.height,
      })
      // TODO check out
      this.hideVolumeBar(0)
    }, 0)

    this.parseColors()

    this.core.$el.append(this.el)

    this.rendered = true
    this.updateVolumeUI()

    this.hasUpdate = false
    // TODO setTimeout?
    this.trigger(Events.MEDIACONTROL_RENDERED)

    return this
  }

  private handleFullScreenOnBtn() {
    this.trigger(Events.MEDIACONTROL_FULLSCREEN, this.name)
    this.container.fullscreen()
    // TODO: fix after it full screen will be fixed on iOS
    if (Browser.isiOS) {
      if (this.core.isFullscreen()) {
        Fullscreen.cancelFullscreen(this.core.el)
      } else {
        Fullscreen.requestFullscreen(this.core.el)
      }
    } else {
      this.core.toggleFullscreen()
    }
    this.resetUserKeepVisible()
  }

  // TODO manage by the ads plugin
  private onStartAd() {
    // this.advertisementPlaying = true
    this.disable()
  }

  // TODO manage by the ads plugin
  private onFinishAd() {
    // this.advertisementPlaying = false
    this.enable()
  }

  // TODO remove
  private hideControllAds() {
    if (
      this.container.advertisement &&
      this.container.advertisement.type !== 'idle'
    ) {
      this.hide()
    }
  }

  private static getPageX(event: MouseEvent | TouchEvent): number {
    return getPageX(event)
  }

  private static getPageY(event: MouseEvent | TouchEvent): number {
    if ((event as MouseEvent).pageY) {
      return (event as MouseEvent).pageY
    }

    if ((event as TouchEvent).changedTouches) {
      return (event as TouchEvent).changedTouches[
        (event as TouchEvent).changedTouches.length - 1
      ].pageY
    }

    return 0
  }

  /**
   * Enable the user interaction disabled earlier
   */
  enableControlButton() {
    this.disabledClickableList.forEach((element) => {
      element.el.css({ 'pointer-events': element.pointerEventValue })
    })
  }

  /**
   * Disable the user interaction for the control buttons
   */
  disabledControlButton() {
    this.disabledClickableList.forEach((element) => {
      element.el.css({ 'pointer-events': 'none' })
    })
  }

  // TODO drop
  private isSeekEnabledForHtml5Playback() {
    if (this.core.getPlaybackType() === Playback.LIVE) {
      return this.options.dvrEnabled
    }

    return isFinite(this.core.activePlayback.getDuration())
  }

  private getElementLocation(name: MediaControlElement) {
    trace(`${T} getElementLocation`, {
      name,
      right: this.settings.right,
      left: this.settings.left,
      default: this.settings.default,
    })
    if (this.settings.right?.includes(name as MediaControlRightElement)) {
      return this.getRightPanel()
    }
    if (this.settings.left?.includes(name as MediaControlLeftElement)) {
      return this.getLeftPanel()
    }
    if (this.settings.default?.includes(name as MediaControlLayerElement)) {
      return this.getCenterPanel()
    }
    return null
  }

  private onDvrStateChanged(dvrInUse: boolean) {
    if (dvrInUse) {
      this.$el.addClass('dvr')
    } else {
      this.$el.removeClass('dvr')
    }
  }
}

MediaControl.extend = function (properties) {
  return extend(MediaControl, properties)
}

function serializeSettings(s: MediaControlSettings) {
  return (s.left.slice() as MediaControlElement[])
    .sort()
    .concat(s.right.slice().sort())
    .concat(s.default.slice().sort())
    .concat([s.seekEnabled as any])
    .join(',')
}
