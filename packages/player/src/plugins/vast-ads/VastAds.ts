import {
  $,
  Browser,
  Container,
  Core,
  Events,
  HTML5Video,
  Log,
  Playback,
  UIContainerPlugin,
  UICorePlugin,
  Utils,
} from '@clappr/core'
import { reportError } from '@gcorevideo/utils'
import assert from 'assert'
import { TimePosition } from '../../playback.types.js'

import { CLAPPR_VERSION } from '../../build.js'
import { ZeptoResult } from '../../types.js'
import { TimerId } from '../../utils/types.js'
import RollManager from './rollmanager.js'
import SCTEManager from './sctemanager.js'
import { VolumeFadeEvents } from '../volume-fade/VolumeFade.js'
import { AdRollItem, AdRollType } from './types.js'

import '../../../assets/vast-ads/style.scss'
import volumeIcon from '../../../assets/icons/new/volume-max.svg'
import volumeMuteIcon from '../../../assets/icons/new/volume-off.svg'

const VERSION = '0.0.1'

type State = 'play' | 'pause' | 'switch' | ''

export class VastAds extends UICorePlugin {
  private _clickToPausePlugin: UIContainerPlugin | null = null

  private _cloneContainerEvents: Record<string, Function> | null = null

  private _clonePlaybackEvents: Record<string, Function> | null = null

  private countMiddleRoll = 0

  private countRepeatableRoll = 0

  private _container: Container | null = null

  private container: Container | null = null

  private _contentElement: HTMLElement | null = null

  private _currentPosition = 0

  private currentState: State = ''

  private _imaIsloaded = false

  private _imaLoadResult = false

  private intervalTimer: TimerId | null = null

  private _playback: Playback | null = null

  private _pluginIsReady = false

  private _posterBigPlayStyle: ZeptoResult | null = null

  private _posterPlugin: UIContainerPlugin | null = null

  private _prevVolumeValue = 0

  private vast: RollManager | null = null

  private _volume = 80

  private startTimeRepeatableRoll = 0

  private startTimeRepeatableRollGap = 0

  private _scteManager = new SCTEManager()

  private $skipAd: ZeptoResult | null = null

  private $muteIcon: ZeptoResult | null = null

  private $areaClick: ZeptoResult | null = null

  private _$adContainer: ZeptoResult | null = null

  private _adContainer: HTMLElement | null = null

  get name() {
    return 'clappr-vast-ad-plugin'
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  static get version() {
    return VERSION
  }

  get mediaControl() {
    return this.core.mediaControl
  }

  override get attributes() {
    return {
      class: this.name,
      'data-vast-ads': '',
    }
  }

  constructor(core: Core) {
    super(core)

    const cfg = this.options.vastAds

    try {
      const no_lib = 'google' in window && (window.google as any).ima

      if (!no_lib || !cfg) {
        this.disable()

        return
      }
    } catch (error) {
      // LogManager.exception(error);
      reportError(error)
      this.disable()

      return
    }

    // TODO: Add an option which is an array of plugin name to disable
    try {
      if (!cfg.preroll) {
        this._pluginError('tag option is required')
        this.disable()

        return
      }
    } catch (error) {
      this._pluginError('tag option is required')
      this.disable()
      // LogManager.message('Advertisement: tag option is required', SentryLogLevel.ERROR);
      reportError(error)

      return
    }

    if (cfg.middleroll?.data?.length > 0) {
      cfg.middleroll.data = cfg.middleroll.data
        .filter(
          ({ startTimePercent }: AdRollItem) =>
            startTimePercent >= 10 && startTimePercent <= 90,
        )
        .sort(
          (a: AdRollItem, b: AdRollItem) =>
            a.startTimePercent - b.startTimePercent,
        )
    }

    if (cfg.repeatableroll?.data?.length > 0) {
      cfg.repeatableroll.data = cfg.repeatableroll.data
        .filter(({ startTime }: AdRollItem) => startTime >= 2)
        .sort((a: AdRollItem, b: AdRollItem) => a.startTime - b.startTime)
    }

    let lang = (this.core.options.language || Utils.getBrowserLanguage())
      .toLowerCase()
      .replace(/_/g, '-')

    if (lang.indexOf('_') < 0) {
      lang += '_' + lang
    }

    if ('google' in window && (window.google as any).ima) {
      ;(window.google as any).ima.settings.setLocale(lang)
    }
  }

  override bindEvents() {
    const no_lib = 'google' in window && (window.google as any).ima

    if (!no_lib) {
      return
    }
    if (this._scteManager) {
      // @ts-ignore
      this._scteManager.on('startSCTERoll', () => {
        this.initializeRollManager({
          type: 'scteroll',
        })
      })

      // @ts-ignore
      this._scteManager.on('stopSCTERoll', () => {
        this._playVideoContent('scteroll')
      })
    }

    this.listenToOnce(this.core, Events.CORE_READY, this._onCoreReady)

    this.listenTo(this.core, Events.CORE_RESIZE, this.playerResize)

    if (this.container) {
      this.listenTo(
        this.container,
        Events.CONTAINER_VOLUME,
        this._onContainerVolume,
      )
    }
    this.listenTo(this.core, VolumeFadeEvents.FADE, this._onVolumeChanged)
    if (this.playback) {
      this.listenTo(this.container, Events.CONTAINER_SEEK, (e: number) => {
        if ((this.container as any).advertisement.type === 'middleroll') {
          this.countMiddleRoll = this.findCloserAdvertisement(
            this.options.vastAds.middleroll,
            'startTimePercent',
            this.countMiddleRoll,
            e,
          )
        } else {
          this.countRepeatableRoll = this.findCloserAdvertisement(
            this.options.vastAds.repeatableroll,
            'startTime',
            this.countRepeatableRoll,
            e,
          )
        }
      })
      this.listenTo(this.playback, Events.PLAYBACK_LEVEL_SWITCH_START, () => {
        if (this.currentState === 'pause') {
          return
        }
        this.currentState = 'switch'
      })

      this.listenTo(
        this.playback,
        Events.PLAYBACK_TIMEUPDATE,
        this.onPlaybackTimeUpdate,
      )

      this.listenTo(this.playback, Events.PLAYBACK_ENDED, this.onPlaybackEnded)

      this._pauserollListeners()
      this.listenToOnce(this.playback, Events.PLAYBACK_PLAY, () => {
        if (this._posterBigPlayStyle) {
          this._posterBigPlayStyle.remove()
          this._posterBigPlayStyle = null
        }
      })
      this.listenTo(
        this.playback,
        Events.PLAYBACK_PLAY,
        this.onPlaybackPlay.bind(this),
      )

      this.listenToOnce(
        this.playback,
        'playback:preroll:request',
        this.onPlaybackPrerollRequest,
      )
    }

    if (this.mediaControl) {
      this.listenToOnce(
        this.mediaControl,
        Events.MEDIACONTROL_CONTAINERCHANGED,
        this.containerChanged,
      )
    }
  }

  private onPlaybackEnded() {
    if (this.playback?.getPlaybackType() !== 'live') {
      this.countMiddleRoll = 0
      this.countRepeatableRoll = 0
      this.initializeRollManager({
        type: 'postroll',
      })
      this._pauserollListeners()
    }
  }

  private onPlaybackPlay() {
    setTimeout(() => {
      const posterPlugin = this.container?.getPlugin('poster_custom')

      posterPlugin?.enable()
      posterPlugin?.$el.hide()
      ;(this._posterPlugin as any)?.$playWrapper.show()
      // TODO trigger event or call a method instead
    }, 0)
  }

  private onPlaybackPrerollRequest() {
    try {
      this.initializeRollManager({
        type: 'preroll',
      })
    } catch (error) {
      // LogManager.exception(error);
      reportError(error)
    }
  }

  private onPlaybackTimeUpdate(e: TimePosition) {
    if ((this.container as any)?.advertisement.type !== 'idle') {
      return
    }
    const middleroll = this._options.VastAds.middleroll

    assert(this.playback, 'playback is not defined')

    if (middleroll && this.playback.getPlaybackType() === 'vod') {
      const currentPercent = Math.floor((e.current / e.total) * 100)
      const middlerollData = middleroll.data[this.countMiddleRoll]

      if (middlerollData && middlerollData.startTimePercent <= currentPercent) {
        // TODO fixit
        // @ts-ignore
        this._currentPosition = this.playback.getCurrentTime()
        this.initializeRollManager({
          type: 'middleroll',
          count: this.countMiddleRoll,
        })
      }
    }

    if (
      this._options.VastAds.repeatableroll &&
      this.playback.getPlaybackType() === 'live'
    ) {
      try {
        if (
          !(this.playback.el as HTMLMediaElement).played ||
          !(this.playback.el as HTMLMediaElement).played.length
        ) {
          return
        }
        let startTime =
          (this.playback.el as HTMLMediaElement).played.start(0) ||
          this.startTimeRepeatableRoll

        if (!this.startTimeRepeatableRoll) {
          if (!startTime) {
            this.startTimeRepeatableRoll = startTime = (
              this.playback.el as HTMLMediaElement
            ).currentTime
          }
        }

        const currentTime =
          (this.playback.el as HTMLMediaElement).currentTime -
          startTime +
          this.startTimeRepeatableRollGap
        const repeatablerollData =
          this._options.VastAds.repeatableroll.data[this.countRepeatableRoll]

        if (repeatablerollData && repeatablerollData.startTime <= currentTime) {
          this.startTimeRepeatableRollGap = currentTime
          this.initializeRollManager({
            type: 'repeatableroll',
          })
        }
      } catch (error) {
        // LogManager.exception(error);
        reportError(error)
      }
    }
  }

  private rebindNextAd() {
    if (Object.keys(this._scteManager).length > 0) {
      this.containerChanged()
    }
  }

  private initializeRollManager({
    type,
    count,
  }: {
    type: AdRollType
    count?: number
  }) {
    this.destroyRoll()
    assert(this._adContainer, '_adContainer is not defined')
    const vast = new RollManager(
      this.core,
      this.options,
      this.$skipAd,
      this.$muteIcon,
      this.$areaClick,
      this._adContainer,
      type,
      count || 0,
      this._volume,
      this._prevVolumeValue,
    )

    // @ts-ignore
    vast.on('advertisement_finish', (data: { type: AdRollType }) => {
      this._playVideoContent(data.type, !!Browser.isiOS)
    })
    // @ts-ignore
    vast.on('advertisement_dont_play', (data: { type: AdRollType }) => {
      this._playVideoContent(data.type, true)
    })
    // @ts-ignore
    vast.on('disable_plugin', (data: { type: AdRollType }) => {
      this._playVideoContent(data.type)
      this.disable()
    })
    // @ts-ignore
    vast.on('advertisement_started', () => {
      this.adsPlaying()
    })
    // @ts-ignore
    vast.on('volume', (obj) => {
      this.changeVolume(obj)
    })
    // @ts-ignore
    vast.on('change_counter', (data) => {
      if (data.type === 'middleroll') {
        this.countMiddleRoll = data.value
      }
      if (data.type === 'repeatableroll') {
        this.countRepeatableRoll = data.value
      }
    })
    this.vast = vast
    vast.setupRoll()
  }

  private changeVolume(obj: { volume: number; mute: boolean }) {
    this._volume = obj.volume
    this.core.options.mute = this.options.mute = obj.mute
    Utils.Config.persist('volume', this._volume)
  }

  private findCloserAdvertisement(
    roll: { data: AdRollItem[] } | undefined,
    key: 'startTime' | 'startTimePercent',
    counter: number,
    time: number,
  ) {
    if (!roll) {
      return -1
    }
    if (roll.data.length <= counter) {
      return -1
    }

    let val = 0

    assert(this.playback, 'playback is not defined')
    if (~key.indexOf('Percent')) {
      val = (time / this.playback.getDuration()) * 100
    } else {
      val = time
    }

    const getNumber = (arr: AdRollItem[], searchNum: number) =>
      arr.find(
        (it) =>
          Math.abs(it[key] - searchNum) ===
          Math.min(...arr.map((it) => Math.abs(it[key] - searchNum))),
      )

    const searchEl = getNumber(roll.data, val)
    if (!searchEl) {
      return -1
    }

    return roll.data.findIndex(
      (el) => el.startTimePercent === searchEl.startTimePercent,
    )
  }

  private _validateData(roll: {
    data: AdRollItem[]
    oneByOne?: boolean
  }): boolean {
    try {
      if (roll.data.length) {
        if (!Object.prototype.hasOwnProperty.call(roll, 'oneByOne')) {
          roll.oneByOne = false
        }

        return true
      } else {
        return false
      }
    } catch (error) {
      // LogManager.exception(error);
      reportError(error)

      return false
    }
  }

  private playerResize(size: { width: number; height: number }) {
    this.$el.removeClass('w370')
    if (size.width <= 370 || this.options.hideVolumeBar) {
      this.$el.addClass('w370')
    }
    if (this.vast) {
      this.vast.playerResize(size)
    }
  }

  private _stopPauserollListeners() {
    // @ts-ignore
    this.stopListening(this.playback, Events.PLAYBACK_PLAY)
    // @ts-ignore
    this.stopListening(this.playback, Events.PLAYBACK_PAUSE)
  }

  private _pauserollListeners() {
    if (!this._validateData(this._options.VastAds.pauseroll)) {
      return
    }
    this._stopPauserollListeners()
    this.currentState = ''
    this.listenTo(this.playback, Events.PLAYBACK_PLAY, () => {
      if (this.currentState === 'pause') {
        this.currentState = 'play'
        setTimeout(() => {
          assert(this.playback, 'playback is not defined')
          this.playback.pause()
          // @ts-ignore
          this._currentPosition = this.playback.getCurrentTime()
          this.initializeRollManager({
            type: 'pauseroll',
          })
        }, 0)

        return
      }
      // @ts-ignore
      this.stopListening(this.playback, Events.PLAYBACK_PAUSE)
      // @ts-ignore
      this.stopListening(this.playback, Events.PLAYBACK_STOP)

      const wsPlugin = this.core.getPlugin('ws_plugin')

      if (
        this.playback?.getPlaybackType() === 'live' &&
        wsPlugin?.state === 'live'
      ) {
        this.listenToOnce(this.playback, Events.PLAYBACK_STOP, () => {
          console.warn('stop stream', this.currentState)
          this.currentState = 'pause'
        })
      } else {
        this.listenToOnce(this.playback, Events.PLAYBACK_PAUSE, () => {
          console.warn('pause stream', this.currentState)
          if (this.currentState === 'switch') {
            return
          }
          this.currentState = 'pause'
        })
      }
      this.currentState = 'play'
    })
  }

  unBindEvents() {
    // @ts-ignore
    this.stopListening(this.core, Events.CORE_READY)
    // @ts-ignore
    this.stopListening(this.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED)
    // @ts-ignore
    this.stopListening(this.container, Events.CONTAINER_LOADEDMETADATA)
  }

  private containerChanged() {
    this.container = this.core.activeContainer
    // TODO don't mutate the container
    ;(this.container as any).advertisement = { type: 'idle' }
    this._container = this.container
    this.playback = this.container?.playback
    assert(this.playback, 'playback is not defined')
    this._contentElement = this.playback.el
    this._volume =
      this.core &&
      this.core.mediaControl &&
      this.core.mediaControl.volume !== null &&
      this.core.mediaControl.volume !== undefined &&
      !isNaN(this.core.mediaControl.volume)
        ? this.core.mediaControl.volume
        : 80
    this._prevVolumeValue = this._volume ? this._volume : 80
    this.core.mediaControl.container.$el.append(this.el)
    this.$el.hide()
    // @ts-ignore
    this.stopListening()
    // @ts-ignore
    this._scteManager.off()
    this.bindEvents()
  }

  private _pluginError(msg: string) {
    console.error(this.name + ': ' + msg)
  }

  private _onCoreReady() {
    this._container = this.core.activeContainer

    if (!this._container) {
      this._pluginError('failed to get Clappr current container')
    }
    // Get current playback. (To get playback element)
    this.playback = this.core.activePlayback
    if (!this.playback) {
      this._pluginError('failed to get Clappr playback')
    }
    // Attempt to get poster plugin. (May interfere with media control)
    this._posterPlugin = this._container?.getPlugin('poster_custom')

    // Attempt to get click-to-pause plugin. (May interfere with advert click handling)
    this._clickToPausePlugin = this._container?.getPlugin(
      'click_to_pause_custom',
    )

    assert(this.playback, 'playback is not defined')
    this._contentElement = this.playback.el

    if (this._pluginIsReady) {
      return
    }

    this._initPlugin()
  }

  set playback(value: Playback) {
    this._scteManager.playback = value
    this._playback = value
  }

  get playback(): Playback | null {
    return this._playback
  }

  private _onContainerVolume(value: number) {
    if (value === 0) {
      this.options.mute = true
    } else {
      this._prevVolumeValue = value
      this.options.mute = false
    }
    this._volume = value
  }

  _onVolumeChanged(e: number) {
    if (this._volume === e || e === 0) {
      return
    }
    this.options.mute = e === 0
    this._volume = e
  }

  _stopListening() {
    try {
      assert(this._container, 'container is not defined')
      if (!this._clonePlaybackEvents) {
        for (const id in this._container._listeningTo) {
          this._clonePlaybackEvents = Object.assign(
            {},
            (this._container._listeningTo as any)[id]._events,
          )
          ;(this._container._listeningTo as any)[id]._events = {}
        }
      }
      if (!this._cloneContainerEvents) {
        this._cloneContainerEvents = Object.assign({}, this._container._events)
        this._container._events = {}
      }
    } catch (error) {
      // LogManager.exception(error);
      reportError(error)
    }
  }

  _startListening() {
    try {
      assert(this._container, 'container is not defined')
      for (const id in this._container._listeningTo) {
        ;(this._container._listeningTo as any)[id]._events = Object.assign(
          {},
          this._clonePlaybackEvents,
        )
      }
      this._container._events = Object.assign({}, this._cloneContainerEvents)
      this._cloneContainerEvents = null
      this._clonePlaybackEvents = null
    } catch (error) {
      // LogManager.exception(error);
      reportError(error)
    }
  }

  _initPlugin() {
    assert(this.playback, 'playback is not defined')
    // Ensure browser can play video content. (Avoid to display an ad with nothing after)
    if ((this.playback as any).name === 'no_op') {
      return
    }

    // Ensure playback is using HTML5 video element if mobile device
    if (this.playback.tagName !== 'video' && Browser.isMobile) {
      this.destroy()

      return
    }

    this._pluginIsReady = true
  }

  private adsPlaying() {
    assert(this.container, 'container is not defined')
    const poster = this.container.getPlugin('poster_custom')

    poster && poster.disable()
    try {
      const logo = this.container.getPlugin('logo')

      logo && logo.disable()
    } catch (error) {
      // LogManager.exception(error);
      reportError(error)
    }

    this.core.mediaControl.disable()
    this.$el.show()
    if ((this.container as any).advertisement.type !== 'scteroll') {
      if (!Browser.isiOS) {
        setTimeout(() => {
          this.playback?.pause()
        }, 0)
      }
      this._stopListening()
    } else {
      assert(
        this.playback instanceof HTML5Video,
        'playback is not an instance of HTML5Video',
      )
      if (!this.playback.isMuted()) {
        ;(this.container as any).advertisement.isMuted = true
        this.playback.mute()
      }
    }
    // TODO trigger event on the core object
    // Player.player.trigger('advertisementIsPlaying', data);

    try {
      const spinnerPlugin = this.container?.getPlugin('spinner')

      spinnerPlugin?.hide()
      spinnerPlugin?.disable()
    } catch (error) {
      // LogManager.exception(error);
      reportError(error)
    }
  }

  private destroyRoll() {
    if (this.vast) {
      // @ts-ignore
      this.vast.off()
      this.vast.destroyRoll()
      this.vast = null
    }
  }

  private _playVideoContent(currentRoll: AdRollType, justPlay?: boolean) {
    // const currentRoll = type;

    this.destroyRoll()
    if (currentRoll === 'preroll') {
      this.options.vastAds[currentRoll] = []
    }

    this.currentState = ''
    this.$el.hide()
    if (!this.options.disableClickOnPause) {
      this._clickToPausePlugin?.enable()
    }

    try {
      const logoPlugin = this.container?.getPlugin('logo')

      logoPlugin?.enable()
    } catch (error) {
      // LogManager.exception(error);
      reportError(error)
    }

    try {
      const spinnerPlugin = this.container?.getPlugin('spinner')

      spinnerPlugin?.enable()
      spinnerPlugin?.hide()
    } catch (error) {
      // LogManager.exception(error);
      reportError(error)
    }

    if (this.intervalTimer !== null) {
      clearInterval(this.intervalTimer)
      this.intervalTimer = null
    }
    // @ts-ignore
    this.stopListening(this.playback, Events.PLAYBACK_PAUSE)
    setTimeout(async () => {
      if (currentRoll === 'scteroll') {
        this.options.mute = this.core.options.mute
        this.setMuted(this.core.options.mute)
        this.core.mediaControl.setInitialVolume()
      }

      // this.adTemplates = null;
      this._posterBigPlayStyle = $(
        '<style>div.play-wrapper { display:none; }</style>',
      )
      this._posterBigPlayStyle.appendTo(this.$el)
      // TODO check that the core event is enough
      // Player.player.trigger('advertisementWasFinished');
      this.core.trigger('core:advertisement:finish')
      assert(this.container, 'container is not defined')
      this.container.trigger('container:advertisement:finish')
      ;(this.container as any).advertisement = { type: 'idle' }
      this.container.enableMediaControl()
      Log.debug('Advertisement', 'advertisement finished and start video')
      const playbackOptions = this.core.options.playback || {}

      playbackOptions.recycleVideo = Browser.isMobile

      if (this._clonePlaybackEvents || this._cloneContainerEvents) {
        this._startListening()
      }

      if (currentRoll === 'preroll' || currentRoll === 'repeatableroll') {
        if (currentRoll === 'repeatableroll') {
          this.startTimeRepeatableRoll = 0
        }

        if (!justPlay) {
          if (this.core.containers) {
            this.core.containers.forEach(function (container: Container) {
              container.destroy()
            })
            this.core.containers = []
          }
        }

        setTimeout(() => {
          this.core.configure({
            playback: playbackOptions,
            sources: this.options.source,
            autoPlay: true,
            disableCanAutoPlay: true,
            mute: this.core.options.mute,
          })
          this.core.activeContainer.mediaControlDisabled = false
        }, 0)

        // TODO figure out where it should go
        // if (currentRoll === 'postroll') {
        //   this.playback.stop();
        // }
      }

      if (currentRoll === 'pauseroll' || currentRoll === 'middleroll') {
        if (Browser.isiOS && this._currentPosition > 0) {
          this.listenToOnce(this.playback, Events.PLAYBACK_PLAY, () => {
            this.playback?.seek(this._currentPosition)
            this._currentPosition = 0
          })
        }
        await this.playback?.play()
        this.options.mute = this.core.options.mute
        this.setMuted(this.core.options.mute)
        this.core.mediaControl.setInitialVolume()
      }
    }, 0)
  }

  override render() {
    this.$skipAd = $("<div class='skip-ad-button control-need-disable'></div>")
    this.$muteIcon = $("<div class='mute-ad-icon control-need-disable'></div>")
    this.$areaClick = $("<div class='area-ad-click enable'></div>")
    this.$muteIcon.append(volumeIcon)
    this.$muteIcon.append(volumeMuteIcon)
    this.$el.append(this.$areaClick)
    this.$el.append(this.$skipAd)
    this.$el.append(this.$muteIcon)
    this.$muteIcon.hide()
    this.$skipAd.hide()
    this.$areaClick.hide()
    this._$adContainer = $('<div />')
      .addClass('preroll-container')
      .attr('data-preroll', '')
    this.$el.append(this._$adContainer)
    this._adContainer = this._$adContainer[0]

    return this
  }

  private setMuted(muted: boolean) {
    this.core.activeContainer.options.mute = muted
  }
}
