import { Events, UICorePlugin, template } from '@clappr/core'
import { AudioTrack } from '@clappr/core/types/base/playback/playback.js'
import { trace } from '@gcorevideo/utils'
import assert from 'assert'

import { CLAPPR_VERSION } from '../../build.js'

import pluginHtml from '../../../assets/audio-selector/track-selector.ejs'
import '../../../assets/audio-selector/style.scss'
import audioArrow from '../../../assets/icons/old/quality-arrow.svg'
import { ZeptoResult } from '../../types.js'

const VERSION: string = '0.0.1'

const T = 'plugins.audio_selector'

/**
 * `PLUGIN` that adds an audio track selector to the media control UI.
 * @beta
 * @remarks
 * TODO
 */
export class AudioSelector extends UICorePlugin {
  private currentTrack: AudioTrack | null = null

  private tracks: AudioTrack[] = []

  /**
   * @internal
   */
  get name() {
    return 'audio_selector'
  }

  /**
   * @internal
   */
  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  /**
   * @internal
   */
  static get version() {
    return VERSION
  }

  private static readonly template = template(pluginHtml)

  /**
   * @internal
   */
  override get attributes() {
    return {
      class: 'media-control-audio-tracks',
      'data-track-selector': '',
    }
  }

  /**
   * @internal
   */
  override get events() {
    return {
      'click [data-track-selector-select]': 'onTrackSelect',
      'click [data-track-selector-button]': 'onShowLevelSelectMenu',
    }
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.onCoreReady)
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.onActiveContainerChanged,
    )
  }

  private onCoreReady() {
    trace(`${T} onCoreReady`)
    const mediaControl = this.core.getPlugin('media_control')
    assert(mediaControl, 'media_control plugin is required')
    this.listenTo(mediaControl, Events.MEDIACONTROL_RENDERED, this.render)
    this.listenTo(
      mediaControl,
      Events.MEDIACONTROL_HIDE,
      this.hideSelectTrackMenu,
    )
  }

  private bindPlaybackEvents() {
    trace(`${T} bindPlaybackEvents`)
    this.currentTrack = null
    this.listenTo(this.core.activePlayback, Events.PLAYBACK_STOP, this.onStop)
    this.setupAudioTrackListeners()
  }

  private setupAudioTrackListeners() {
    this.listenTo(
      this.core.activePlayback,
      Events.PLAYBACK_AUDIO_AVAILABLE,
      (tracks: AudioTrack[]) => {
        trace(`${T} on PLAYBACK_AUDIO_AVAILABLE`, { audioTracks: tracks })
        this.currentTrack =
          tracks.find((track) => track.kind === 'main') ?? null
        this.fillTracks(tracks)
      },
    )

    this.listenTo(
      this.core.activePlayback,
      Events.PLAYBACK_AUDIO_CHANGED,
      (track: AudioTrack) => {
        trace(`${T} PLAYBACK_AUDIO_CHANGED`, { audioTrack: track })
        this.currentTrack = track
        this.highlightCurrentTrack()
        this.buttonElement().removeClass('changing')
        this.updateText()
      },
    )
  }

  private onStop() {
    trace(`${T} onStop`)
  }

  private onActiveContainerChanged() {
    trace(`${T} onActiveContainerChanged`)
    this.bindPlaybackEvents()
  }

  private shouldRender() {
    if (!this.core.activePlayback) {
      return false
    }

    this.tracks = this.core.activePlayback.audioTracks

    // Only care if we have at least 2 to choose from
    return this.tracks && this.tracks.length > 1
  }

  /**
   * @internal
   */
  override render() {
    if (!this.shouldRender()) {
      return this
    }

    const mediaControl = this.core.getPlugin('media_control')
    this.$el.html(
      AudioSelector.template({ tracks: this.tracks, title: this.getTitle() }),
    )
    this.$('.audio-arrow').append(audioArrow)
    mediaControl.putElement('audioTracksSelector', this.$el)

    this.updateText()
    this.highlightCurrentTrack()

    return this
  }

  private fillTracks(tracks: AudioTrack[]) {
    this.tracks = tracks
    this.render()
  }

  private findTrackBy(id: string) {
    return this.tracks.find((track) => track.id === id)
  }

  private onTrackSelect(event: MouseEvent) {
    const id = (event.target as HTMLElement)?.dataset?.trackSelectorSelect
    if (id) {
      this.selectAudioTrack(id)
    }
    this.toggleContextMenu()
    event.stopPropagation()
    return false
  }

  private selectAudioTrack(id: string) {
    this.startTrackSwitch()
    this.core.activePlayback.switchAudioTrack(id)
    this.updateText()
  }

  private onShowLevelSelectMenu() {
    this.toggleContextMenu()
  }

  private hideSelectTrackMenu() {
    ;(this.$('ul') as ZeptoResult).hide()
  }

  private toggleContextMenu() {
    ;(this.$('ul') as ZeptoResult).toggle()
  }

  private buttonElement(): ZeptoResult {
    return this.$('button')
  }

  private buttonElementText(): ZeptoResult {
    return this.$('button .audio-text')
  }

  private trackElement(id?: string): ZeptoResult {
    return (
      this.$(
        'ul a' +
          (id !== undefined ? '[data-track-selector-select="' + id + '"]' : ''),
      ) as ZeptoResult
    ).parent()
  }

  private getTitle(): string {
    return this.currentTrack?.label || ''
  }

  private startTrackSwitch() {
    this.buttonElement().addClass('changing')
  }

  private updateText() {
    if (!this.currentTrack) {
      return
    }
    this.buttonElementText().text(this.currentTrack.label)
  }

  private highlightCurrentTrack() {
    this.trackElement().removeClass('current')
    this.trackElement().find('a').removeClass('gcore-skin-active')

    if (this.currentTrack) {
      this.trackElement(this.currentTrack.id)
        .addClass('current')
        .find('a')
        .addClass('gcore-skin-active')
    }
  }
}
