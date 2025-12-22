import { Events, UICorePlugin, template } from '@clappr/core'
import { AudioTrack } from '@clappr/core/types/base/playback/playback.js'
import assert from 'assert'
// import { trace } from '@gcorevideo/utils'

import { CLAPPR_VERSION } from '../../build.js'

import pluginHtml from '../../../assets/audio-tracks/template.ejs'
import audioArrow from '../../../assets/icons/old/quality-arrow.svg'
import { ZeptoResult } from '../../types.js'
import { ExtendedEvents, MediaControl } from '../media-control/MediaControl.js'
import { mediaControlClickaway } from '../../utils/clickaway.js'

const VERSION: string = '2.22.4'

// const T = 'plugins.audiotracks'

/**
 * `PLUGIN` that makes possible to switch audio tracks via the media control UI.
 * @public
 * @remarks
 * The plugin is activated when there are multiple audio tracks available.
 * The plugin adds a button showing the current audio track and a dropdown to switch to another audio track.
 * Depends on:
 *
 * - {@link MediaControl}
 */
export class AudioTracks extends UICorePlugin {
  private currentTrack: AudioTrack | null = null

  private open = false

  private tracks: AudioTrack[] = []

  /**
   * @internal
   */
  get name() {
    return 'audio_tracks'
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
      class: 'media-control-audiotracks media-control-dd__wrap',
    }
  }

  /**
   * @internal
   */
  override get events() {
    return {
      'click #gplayer-audiotracks-menu [data-item]': 'onTrackSelect',
      'click #gplayer-audiotracks-button': 'toggleMenu',
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
      this.mount()
    })
    // TODO when tracks change, re-render and re-attach
    this.listenTo(mediaControl, Events.MEDIACONTROL_HIDE, this.hideMenu)
    this.listenTo(
      mediaControl,
      ExtendedEvents.MEDIACONTROL_MENU_COLLAPSE,
      (from: string) => {
        if (from !== this.name) {
          this.hideMenu()
        }
      },
    )
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
        this.mount()
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
    // TODO test
    this.listenTo(this.core.activeContainer, Events.CONTAINER_CLICK, () => {
      this.hideMenu()
    })
    this.listenTo(this.core.activeContainer, Events.CONTAINER_DESTROYED, () => {
      this.clickaway(null)
    })
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
    this.$el.html(
      AudioTracks.template({
        tracks: this.tracks ?? [],
        title: this.getTitle(),
        icon: audioArrow,
        current: this.currentTrack?.id,
      }),
    )
    this.$el.find('#gplayer-audiotracks-menu').hide()
    this.updateText()
    this.highlightCurrentTrack()

    return this
  }

  private onTrackSelect(event: MouseEvent) {
    const id = (event.currentTarget as HTMLElement)?.dataset?.item
    if (id) {
      this.selectAudioTrack(id)
    }
    this.hideMenu()
    event.stopPropagation()
    return false
  }

  private selectAudioTrack(id: string) {
    this.startTrackSwitching()
    this.core.activeContainer.switchAudioTrack(id)
    this.updateText()
  }

  private hideMenu() {
    this.open = false
    this.$el.find('#gplayer-audiotracks-menu').hide()
    this.$el.find('#gplayer-audiotracks-button').attr('aria-expanded', 'false')
    this.setKeepVisible(false)
  }

  private toggleMenu() {
    this.open = !this.open

    this.core
      .getPlugin('media_control')
      .trigger(ExtendedEvents.MEDIACONTROL_MENU_COLLAPSE, this.name)
    if (this.open) {
      this.$el.find('#gplayer-audiotracks-menu').show()
    } else {
      this.$el.find('#gplayer-audiotracks-menu').hide()
    }
    this.$el
      .find('#gplayer-audiotracks-button')
      .attr('aria-expanded', this.open)

    this.setKeepVisible(this.open)
  }

  private setKeepVisible(keepVisible: boolean) {
    this.core.getPlugin('media_control').setKeepVisible(keepVisible)
    this.clickaway(keepVisible ? this.core.activeContainer.$el[0] : null)
  }

  private buttonElement(): ZeptoResult {
    return this.$('#gplayer-audiotracks-button')
  }

  private buttonElementText(): ZeptoResult {
    return this.$el.find('#gplayer-audiotracks-button-text')
  }

  private trackElement(id?: string): ZeptoResult {
    return (
      this.$(
        '#gplayer-audiotracks-menu a' +
        (id !== undefined ? `[data-item="${id}"]` : ''),
      ) as ZeptoResult
    ).parent()
  }

  private getTitle(): string {
    if (!this.currentTrack) {
      return ''
    }
    return this.currentTrack.label || this.currentTrack.language
  }

  private startTrackSwitching() {
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
    this.trackElement()
      .find('a')
      .removeClass('gcore-skin-active')
      .attr('aria-checked', 'false')

    if (this.currentTrack) {
      this.trackElement(this.currentTrack.id)
        .addClass('current')
        .find('a')
        .addClass('gcore-skin-active')
        .attr('aria-checked', 'true')
    }
  }

  private mount() {
    if (this.shouldRender()) {
      this.core.getPlugin('media_control')?.slot('audiotracks', this.$el)
    }
  }

  private clickaway = mediaControlClickaway(() => this.hideMenu())
}
