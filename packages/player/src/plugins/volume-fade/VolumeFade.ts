import { UICorePlugin, Events, Browser, $, Core } from '@clappr/core'
import { reportError, trace } from '@gcorevideo/utils'

import { TimerId } from '../../utils/types.js'
import { ExtendedEvents } from '../media-control/MediaControl.js'

/**
 * Events emitted by the VolumeFade plugin.
 * @public
 */
export enum VolumeFadeEvents {
  FADE = 'core:volume:fade',
}

const T = 'plugins.volume_fade'

const DEFAULT_DURATION = 600
const DEFAULT_VOLUME_LEVEL = 80

/**
 * @public
 */
export type VolumeFadeSettings = {
  /**
   * Initial active volume level, effective until volume is changed via media control
   */
  level?: number
  /**
   * Fade duration, ms
   */
  duration?: number
}

/**
 * `PLUGIN` that mutes the sound and fades it in when the mouse is over the player.
 * @public
 *
 * @remarks
 * When the user moves the mouse over and away from the player, the sound is unmuted and unmuted with a fade effect.
 *
 * Depends on {@link MediaControl} plugin.
 * Configuration options - {@link VolumeFadeSettings}
 */
export class VolumeFade extends UICorePlugin {
  private activeVolume = 0

  private duration = 0

  private timerId: TimerId | null = null

  /**
   * @internal
   */
  get name() {
    return 'volume_fade'
  }

  constructor(core: Core) {
    super(core)
    if (typeof this.options.volumeFade?.level === 'number') {
      this.activeVolume = this.options.volumeFade.level
    }
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.onCoreReady)
  }

  private onCoreReady() {
    const mediaControl = this.core.getPlugin('media_control')
    if (Browser.isMobile) {
      this.destroy()
      return
    }
    if (mediaControl) {
      this.listenTo(
        mediaControl,
        ExtendedEvents.MEDIACONTROL_VOLUME,
        this.onVolumeChange,
      )
    }
    $(this.core.$el).on('mouseenter', () => this.onEnter())
    $(this.core.$el).on('mouseleave', () => this.onLeave())
    if (!this.activeVolume) {
      this.activeVolume =
        this.core.activeContainer?.volume &&
        !isNaN(this.core.activeContainer.volume)
          ? this.core.activeContainer.volume
          : DEFAULT_VOLUME_LEVEL
    }

    this.duration = this.options.volumeFade?.duration || DEFAULT_DURATION
    // TODO check if `mute` must be respected
    this.core.activeContainer?.setVolume(this.activeVolume)
    this.core.activePlayback.volume(0)
  }

  private onVolumeChange(volume: number) {
    trace(`${T} onVolumeChange`, { volume })
    this.activeVolume = volume
  }

  private onEnter() {
    trace(`${T} onEnter`)
    this.fade(this.duration, 1)
  }

  private onLeave() {
    trace(`${T} onLeave`)
    this.fade(this.duration, 0)
  }

  private fade(duration: number, to: 0 | 1) {
    this.stopFade()
    const start = new Date().getTime()
    const from = 1 - to
    this.timerId = setInterval(() => {
      const delta = new Date().getTime() - start
      const progress = Math.min(1, delta / duration)
      const normVol = progress * to + (1 - progress) * from
      const volume = normVol * this.activeVolume
      this.core.activePlayback.volume(volume)
      try {
        this.core.trigger(VolumeFadeEvents.FADE, volume)
      } catch (error) {
        reportError(error)
      }
      if (progress >= 1) {
        this.stopFade()
      }
    }, 10)
  }

  private stopFade() {
    trace(`${T} stopFade`)
    if (this.timerId !== null) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }
}
