import {
  Browser,
  Core,
  Events,
  Playback,
  template,
  UICorePlugin,
} from '@clappr/core'
import { reportError, trace } from '@gcorevideo/utils'
import { guessMimeType, MIME_TYPE_DASH } from '../../utils/mediaSources.js'

import { CLAPPR_VERSION } from '../../build.js'

import pluginHtml from '../../../assets/multi-camera/multicamera.ejs'
import '../../../assets/multi-camera/style.scss'

import streamsIcon from '../../../assets/icons/old/streams.svg'
import { PlayerMediaSource, TransportPreference, ZeptoResult } from '../../types.js'

/**
 * @beta
 */
export type MultisourcesMode = 'one_first' | 'only_live' | 'show_all'

/**
 * Extended media source description
 * @beta
 */
export type MulticCameraSourceInfo = {
  description: string
  dvr: boolean
  hls_mpegts_url: string | null
  id: number
  live: boolean
  projection: string | null
  screenshot: string | null
  source: string
  source_dash: string | null
  title: string
}

const VERSION = '0.0.1'

const T = 'plugins.multicamera'

/**
 * `PLUGIN` that adds support for loading multiple streams and switching between them using the media control UI.
 * @beta
 */
export class MultiCamera extends UICorePlugin {
  private currentCamera: MulticCameraSourceInfo | null = null

  private currentTime: number = 0

  private playing = false

  private multicamera: MulticCameraSourceInfo[] = []

  private noActiveStreams = false

  get name() {
    return 'multicamera'
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  static get version() {
    return VERSION
  }

  get template() {
    return template(pluginHtml)
  }

  override get attributes() {
    return {
      class: this.name,
      'data-multicamera': '',
    }
  }

  override get events() {
    return {
      'click [data-multicamera-selector-select]': 'onCameraSelect',
      'click [data-multicamera-button]': 'onShowLevelSelectMenu',
    }
  }

  constructor(core: Core) {
    super(core)
    if (
      !this.options.multisources ||
      !Array.isArray(this.options.multisources)
    ) {
      this.destroy()
      return
    }
    this.playing = this.options.multicameraPlay
    // Don't mutate the options, TODO check if some plugin observes the options.multicamera
    this.multicamera = this.options.multisources.map(
      (item: MulticCameraSourceInfo) => ({ ...item }),
    )
    this.noActiveStreams = this.multicamera.every((item) => !item.live)
    // TODO filter out non-live
    this.core.options.sources = expandMediaSource(this.multicamera[0])
  }

  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.bindPlaybackEvents)
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_CONTAINERCHANGED,
      this.reload,
    )
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_RENDERED,
      this.render,
    )
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_HIDE,
      this.hideSelectLevelMenu,
    )
  }

  private unBindEvents() {
    this.stopListening(this.core, Events.CORE_READY, this.bindPlaybackEvents)
    this.stopListening(
      this.core.mediaControl,
      Events.MEDIACONTROL_CONTAINERCHANGED,
      this.reload,
    )
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_RENDERED, this.render)
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_HIDE, this.hideSelectLevelMenu)
    this.stopListening(
      this.core.activePlayback,
      Events.PLAYBACK_PLAY,
      this.onPlay,
    )
  }

  private onPlay() {
    this.playing = true
  }

  private bindPlaybackEvents() {
    const currentPlayback = this.core.activePlayback

    this.listenToOnce(currentPlayback, Events.PLAYBACK_PLAY, this.onPlay)
  }

  private reload() {
    this.unBindEvents()
    this.bindEvents()
    this.bindPlaybackEvents()
  }

  private shouldRender() {
    if (this.noActiveStreams) {
      return false
    }

    return this.multicamera.length >= 2
  }

  override render() {
    if (!this.core.activeContainer || !this.core.activePlayback) {
      return this
    }
    if (!this.shouldRender()) {
      return this
    }

    let numActiveSources = 0
    const currentSource = this.core.activePlayback?.sourceMedia

    for (const item of this.multicamera) {
      if (item.live) {
        numActiveSources++
      }
      if (!this.currentCamera && item.source === currentSource) {
        this.currentCamera = item
      }
    }

    if (
      this.currentTime &&
      this.core.getPlaybackType() !== Playback.LIVE
    ) {
      if (this.currentTime < this.core.activePlayback.getDuration()) {
        this.core.activePlayback.seek(this.currentTime)
      }

      this.currentTime = 0
    }

    this.$el.html(
      this.template({
        streams: this.multicamera,
        multisources_mode: this.options.multisourcesMode,
      }),
    )

    if (
      (numActiveSources < 2 &&
        this.options.multisourcesMode !== 'show_all') ||
      this.options.multisourcesMode === 'one_first'
    ) {
      this.$el.hide()
    } else {
      this.$el.show()
    }

    const mediaControl = this.core.getPlugin('media_control')

    mediaControl.slot('multicamera', this.$el)
    this.$el
      .find('span.multicamera-icon')
      .html(streamsIcon)
    this.highlightCurrentLevel()

    return this
  }

  private onCameraSelect(event: MouseEvent) {
    const value = (event.currentTarget as HTMLElement).dataset
      .multicameraSelectorSelect
    trace(`${T} onCameraSelect`, { value })
    if (value !== undefined) {
      this.changeById(parseInt(value, 10))
    }
    event.stopPropagation()
    return false
  }

  private setLiveStatus(id: number, active: boolean) {
    try {
      const index = this.findIndexById(id)
      if (index < 0) {
        return
      }
      this.multicamera[index].live = active
      if (this.levelElement(id).length) {
        this.levelElement(id)[0].dataset.multicameraSelectorLive = active
      }
    } catch (error) {
      reportError(error)
    }
  }

  private behaviorLive(id: number, active: boolean) {
    try {
      if (active) {
        this.levelElement(id).parent().show()
      } else {
        this.levelElement(id).parent().hide()
      }
    } catch (error) {
      reportError(error)
      return
    }

    this.findAndInitNextStream(id, active)
  }

  private behaviorOne(id: number, active: boolean) {
    this.$el.hide()
    this.findAndInitNextStream(id, active)
  }

  private behaviorAll(id: number, active: boolean) {
    if (this.currentCamera?.id === id) {
      if (active) {
        this.hideError()
        this.changeById(id)
      } else {
        this.showError()
      }
    }
  }

  private findAndInitNextStream(id: number, active: boolean) {
    if (active || this.currentCamera?.id !== id) {
      return
    }

    const current = this.findIndexById(id)
    let counter = 1

    while (counter < this.multicamera.length) {
      const changeIndex = (counter + current) % this.multicamera.length
      if (this.multicamera[changeIndex].live) {
        this.changeById(this.multicamera[changeIndex].id)
        return
      }
      counter++
    }
    this.currentCamera = null
    this.noActiveStreams = true
    this.core.trigger('core:multicamera:no_active_translation')
  }

  private showError() {
    this.core.activePlayback.pause()
    setTimeout(() => {
      this.core.activePlayback.destroy()
    }, 0)
    try {
      this.core.mediaControl.disabledControlButton()
    } catch (error) {
      reportError(error)
    }
    // TODO trigger error instead
    this.core.getPlugin('error_screen')?.show({
      title: this.core.i18n.t('source_offline'),
      message: '',
      code: '',
      icon: '',
    })
  }

  private hideError() {
    try {
      this.core.getPlugin('media_control')?.enableControlButton()
    } catch (error) {
      reportError(error)
    }
  }

  private changeById(id: number) {
    trace(`${T} changeById`, { id })
    queueMicrotask(() => {
      const playbackOptions = this.core.options.playback || {}

      // TODO figure out if it's needed
      playbackOptions.recycleVideo = Browser.isMobile
      this.currentCamera = this.findElementById(id)

      if (!this.currentCamera) {
        return
      }
      this.currentTime = 0
      try {
        this.currentTime = this.core.activePlayback.getCurrentTime()
        this.highlightCurrentLevel()
        this.core.activePlayback.destroy()
      } catch (error) {
        reportError(error)
      }
      const fullscreenDisable = !!(
        Browser.isiOS && this.currentCamera.projection
      )

      // TODO remove?
      // for html5 playback:
      this.options.dvrEnabled = this.currentCamera.dvr

      trace(`${T} changeById`, { currentCamera: this.currentCamera })
      // TODO
      this.core.configure({
        playback: playbackOptions,
        source: this.currentCamera.source, // TODO ensure that the preferred transport is used
        fullscreenDisable,
        autoPlay: this.playing,
        disableCanAutoPlay: true,
      })
      this.core.activeContainer?.enableMediaControl()
    })
    this.toggleContextMenu()
  }

  private findElementById(id: number): MulticCameraSourceInfo | null {
    return this.multicamera.find((element) => element.id === id) ?? null
  }

  private findIndexById(id: number): number {
    return this.multicamera.findIndex((element) => element.id === id)
  }

  private onShowLevelSelectMenu() {
    this.toggleContextMenu()
  }

  private hideSelectLevelMenu() {
    ; (this.$('ul') as ZeptoResult).hide()
  }

  private toggleContextMenu() {
    ; (this.$('ul') as ZeptoResult).toggle()
  }

  private levelElement(id?: number): ZeptoResult {
    return this.$(
      'ul .multicamera-item' +
      (id !== undefined
        ? '[data-multicamera-selector-select="' + id + '"]'
        : ''),
    )
  }

  private highlightCurrentLevel() {
    this.levelElement().removeClass('current')
    this.levelElement().removeClass('multicamera-active')
    this.currentCamera &&
      this.levelElement(this.currentCamera.id).addClass('multicamera-active')
  }
}

function expandMediaSource(source: MulticCameraSourceInfo): PlayerMediaSource[] {
  const result: PlayerMediaSource[] = [{
    source: source.source,
    mimeType: guessMimeType(source.source),
  }]
  if (source.source_dash) {
    result.push({
      source: source.source_dash,
      mimeType: MIME_TYPE_DASH,
    })
  }
  if (source.hls_mpegts_url) {
    result.push(source.hls_mpegts_url)
  }
  return result
}
