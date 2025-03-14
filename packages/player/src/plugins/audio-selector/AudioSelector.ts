import { Events, UICorePlugin, template } from '@clappr/core'
import { AudioTrack } from '@clappr/core/types/base/playback/playback.js'
import assert from 'assert'

import { CLAPPR_VERSION } from '../../build.js'

import pluginHtml from '../../../assets/audio-selector/track-selector.ejs'
import '../../../assets/audio-selector/style.scss'
import audioArrow from '../../../assets/icons/old/quality-arrow.svg'
import { ZeptoResult } from '../../types.js'
import { MediaControl } from '../media-control/MediaControl.js'

const VERSION: string = '2.22.4'

// const T = 'plugins.audiotracks'

/**
 * `PLUGIN` that makes possible to switch audio tracks via the media control UI.
 * @beta
 * @remarks
 * The plugin is activated when there are multiple audio tracks available.
 * The plugin adds a button showing the current audio track and a dropdown to switch to another audio track.
 * Depends on:
 *
 * - {@link MediaControl}
 */
export class AudioTracks extends UICorePlugin {
  private currentTrack: AudioTrack | null = null

  private tracks: AudioTrack[] = []

  /**
   * @internal
   */
  get name() {
    return 'audio_selector' // TODO rename to audiotracks
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
      class: 'media-control-audiotracks',
    }
  }

  /**
   * @internal
   */
  override get events() {
    return {
      'click [data-audiotracks-select]': 'onTrackSelect',
      'click #audiotracks-button': 'toggleContextMenu',
    }
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenToOnce(this.core, Events.CORE_READY, this.onCoreReady)
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.onActiveContainerChanged,
    )
  }

  private onCoreReady() {
    const mediaControl = this.core.getPlugin('media_control')
    assert(mediaControl, 'media_control plugin is required')
    this.listenTo(mediaControl, Events.MEDIACONTROL_RENDERED, () => {
      mediaControl.putElement('audiotracks', this.$el)
    })
    this.listenTo(mediaControl, Events.MEDIACONTROL_HIDE, this.hideMenu)
  }

  private onActiveContainerChanged() {
    this.currentTrack = null
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_AUDIO_AVAILABLE,
      (tracks: AudioTrack[]) => {
        this.currentTrack =
          tracks.find((track) => track.kind === 'main') ?? null // TODO test
        this.tracks = tracks
        this.render()
      },
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_AUDIO_CHANGED,
      (track: AudioTrack) => {
        this.currentTrack = track
        this.highlightCurrentTrack()
        this.buttonElement().removeClass('changing')
        this.updateText()
      },
    )
  }

  private shouldRender() {
    // Render is called from the parent class constructor so tracks aren't available
    // Only care if we have at least 2 to choose from
    return this.tracks?.length > 1
  }

  /**
   * @internal
   */
  override render() {
    if (!this.shouldRender()) {
      return this
    }

    const mediaControl = this.core.getPlugin('media_control') as MediaControl
    this.$el.html(
      AudioTracks.template({
        tracks: this.tracks,
        title: this.getTitle(),
        icon: audioArrow,
      }),
    )
    this.updateText()
    this.highlightCurrentTrack()

    return this
  }

  private onTrackSelect(event: MouseEvent) {
    const id = (event.target as HTMLElement)?.dataset?.audiotracksSelect
    if (id) {
      this.selectAudioTrack(id)
    }
    this.hideMenu()
    event.stopPropagation()
    return false
  }

  private selectAudioTrack(id: string) {
    this.startTrackSwitch()
    this.core.activeContainer.switchAudioTrack(id)
    this.updateText()
  }

  private hideMenu() {
    this.$el.find('#audiotracks-select').addClass('hidden')
  }

  private toggleContextMenu() {
    this.$el.find('#audiotracks-select').toggleClass('hidden')
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
        '#audiotracks-select a' +
          (id !== undefined ? `[data-audiotracks-select="${id}"]` : ''),
      ) as ZeptoResult
    ).parent()
  }

  private getTitle(): string {
    if (!this.currentTrack) {
      return ''
    }
    return this.currentTrack.label || this.currentTrack.language
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
