import { UICorePlugin, Events, template } from '@clappr/core'
import { trace } from '@gcorevideo/utils'

import { CLAPPR_VERSION } from '../../build.js'

import reloadIcon from '../../../assets/icons/old/reload.svg'
import templateHtml from '../../../assets/error-screen/error_screen.ejs'
import '../../../assets/error-screen/error_screen.scss'
import { PlaybackError } from '../../playback.types.js'

type ErrorScreenDesc = {
  title: string
  message: string
  code: string
  icon?: string
}

/**
 * Configuration options for the {@link ErrorScreen | error screen} plugin.
 * @beta
 */
export type ErrorScreenPluginSettings = {
  /**
   * Whether to hide the reload button.
   */
  noReload?: boolean
}

const T = 'plugins.error_screen'

/**
 * `PLUGIN` that displays errors nicely in the overlay on top of the player.
 * @beta
 */
export class ErrorScreen extends UICorePlugin {
  private err: ErrorScreenDesc | null = null

  /**
   * @internal
   */
  get name() {
    return 'error_screen'
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
  override get attributes() {
    return {
      class: 'player-error-screen',
      'data-error-screen': '',
    }
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.core, Events.ERROR, this.onError)
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.onActiveContainerChanged,
    )
  }

  private onPlay() {
    trace(`${T} onPlay`)
    this.unmount()
  }

  private unmount() {
    trace(`${T} unmount`)
    this.err = null
    this.$el.remove()
  }

  /**
   * @internal
   */
  override get events() {
    return {
      'click .player-error-screen__reload': 'reload',
    }
  }

  private reload() {
    setTimeout(() => {
      this.core.configure({
        reloading: true,
        source: this.core.options.source,
        sources: this.core.options.sources,
      })
    }, 0)
  }

  private onActiveContainerChanged() {
    trace(`${T} onActiveContainerChanged`, {
      reloading: this.core.options.reloading,
    })
    this.err = null
    this.listenTo(
      this.core.activeContainer.playback,
      Events.PLAYBACK_PLAY,
      this.onPlay,
    )
    if (this.core.options.reloading) {
      setTimeout(() => {
        this.core.options.reloading = false
        this.unmount()
        this.core.activeContainer.play({
          reloading: true,
        })
      }, 0)
    }
  }

  private onError(err: PlaybackError) {
    trace(`${T} onError`, { err })
    if (err.UI) {
      if (this.err) {
        this.unmount()
      }
      this.err = {
        title: err.UI.title,
        message: err.UI.message,
        code: err.code,
        icon: err.UI.icon,
      }
      this.render()
    }
  }

  /**
   * @internal
   */
  override render() {
    if (!this.err) {
      return this
    }
    this.$el.html(
      ErrorScreen.template({
        ...this.err,
        reloadIcon: this.options.errorScreen?.noReload ? null : reloadIcon,
      }),
    )

    // TODO append to container instead of core?
    if (!this.el.parentElement) {
      this.core.$el.append(this.el)
    }

    return this
  }
}
