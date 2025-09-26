import { Events, template, UICorePlugin, Utils } from '@clappr/core'
import { trace } from '@gcorevideo/utils'

import { CLAPPR_VERSION } from '../../build.js'

import volumeMuteIcon from '../../../assets/icons/new/volume-off.svg'
import templateHtml from '../../../assets/big-mute-button/big-mute-button.ejs'
import '../../../assets/big-mute-button/big-mute-button.scss'

const T = 'plugins.big_mute_button'

// TODO rewrite as a container plugin

/**
 * `PLUGIN` that displays a big mute button over the video when it's being played muted.
 * @public
 * @remarks
 * When pressed, it unmutes the video.
 * @example
 * ```ts
 * import { BigMuteButton } from '@gcorevideo/player'
 * Player.registerPlugin(BigMuteButton)
 * ```
 */
export class BigMuteButton extends UICorePlugin {
  private autoPlay = false

  private hidden = false

  // TODO get back to the ads-related logic later
  private _adIsPlaying = false

  /**
   * @internal
   */
  get name() {
    return 'big_mute_button'
  }

  /**
   * @internal
   */
  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  private static readonly template = template(templateHtml)

  /**
   * @internal
   */
  override get events() {
    return {
      click: 'clicked',
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
      this.onContainerChanged,
    )
    this.listenTo(this.core, 'core:advertisement:start', this.onStartAd)
    this.listenTo(this.core, 'core:advertisement:finish', this.onFinishAd)
  }

  private onCoreReady() {}

  private onContainerChanged() {
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_VOLUME,
      this.onContainerVolume,
    )
    this.listenTo(
      this.core.activePlayback,
      Events.PLAYBACK_ENDED,
      this.onPlaybackEnded,
    )
    this.listenTo(this.core.activeContainer, Events.CONTAINER_PLAY, this.onPlay)
    this.listenTo(this.core.activeContainer, Events.CONTAINER_STOP, this.onStop)
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_PAUSE,
      this.onPause,
    )
  }

  private onPlay(_: string, { autoPlay }: { autoPlay?: boolean }) {
    const container = this.core.activeContainer
    const { volume } = container
    const { wasMuted } = this.options
    if (autoPlay) {
      this.autoPlay = true
    }
    trace(`${T} onPlay`, {
      autoPlay: this.autoPlay,
      wasMuted,
      volume,
    })
    if (this.autoPlay && !wasMuted && volume === 0) {
      this.mount()
    } else {
      this.destroy()
    }
  }

  private onStop(_: string, metadata?: { ui?: boolean }) {
    const ui = metadata?.ui
    trace(`${T} onStop`, { ui })
    if (ui) {
      this.destroy()
    }
  }

  private onPause() {
    this.destroy()
  }

  private onContainerVolume(value: number) {
    if (value !== 0) {
      this.destroy()
    }
  }

  private onPlaybackEnded() {
    this.hide()
  }

  private onStartAd() {
    this._adIsPlaying = true
    this.hide()
  }

  private onFinishAd() {
    this._adIsPlaying = false
    this.show()
  }

  /**
   * @internal
   */
  override render() {
    this.$el.html(BigMuteButton.template())
    this.$el.find('#gplayer-big-mute-icon').append(volumeMuteIcon)

    // TODO
    // this._adIsPlaying && this.hide()

    return this
  }

  private mount() {
    this.core.activeContainer.$el.append(this.$el)
    this.show()
  }

  private hide() {
    this.hidden = true
    this.$el.find('#gplayer-big-mute-button')?.addClass('hide')
  }

  private show() {
    this.hidden = false
    this.$el.find('#gplayer-big-mute-button')?.removeClass('hide')
  }

  private clicked(e: MouseEvent) {
    const mediaControl = this.core.getPlugin('media_control')
    // TODO delegate to media_control plugin
    const localVolume = Utils.Config.restore('volume')
    const volume = !isNaN(localVolume) ? localVolume : 100
    const unmuted = volume === 0 ? 100 : volume

    if (mediaControl) {
      mediaControl.setVolume(unmuted)
    } else {
      this.core.activeContainer.setVolume(unmuted)
    }

    e.stopPropagation?.()

    this.destroy()
  }
}
