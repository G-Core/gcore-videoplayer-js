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
 * Settings for the {@link ErrorScreen} plugin.
 * @public
 */
export type ErrorScreenSettings = {
  /**
   * Whether to hide the reload button. The reload button triggers reload of the current source.
   */
  noReload?: boolean
}

/**
 * Configuration options for the {@link ErrorScreen} plugin.
 * @public
 */
export type ErrorScreenPluginSettings = {
  /**
   * Whether to hide the reload button.
   */
  noReload?: boolean
}

const T = 'plugins.error_screen'

/**
 * `PLUGIN` that displays fatal errors nicely in the overlay on top of the player.
 * @public
 * @remarks
 * A fatal error is an error that prevents the player from playing the content.
 * It's usually a network error that persists after multiple retries.
 *
 * The error screen should not be confused with the content stub that is shown when no media sources are available.
 * This can happen due to the lack of the support of the given sources type or because the sources are misconfigured (e.g., omitted).
 *
 * Configuration options - {@link ErrorScreenPluginSettings}
 *
 * @example
 * ```ts
 * import { ErrorScreen, Player } from '@gcorevideo/player'
 *
 * Player.registerPlugin(ErrorScreen)
 * ```
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
    trace(`${T} reload`)
    setTimeout(() => {
      this.core.configure({
        reloading: true,
        source: this.core.options.source,
        sources: this.core.options.sources,
      })
    }, 0)
  }

  private onActiveContainerChanged() {
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
        i18n: this.core.i18n,
      }),
    )

    if (!this.el.parentElement) {
      this.core.$el.append(this.el)
    }

    return this
  }
}
