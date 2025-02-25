import { Core, Events, Playback, UICorePlugin, template } from '@clappr/core'
import assert from 'assert'

import { CLAPPR_VERSION } from '../../build.js'

import dvrHTML from '../../../assets/dvr-controls/index.ejs'
import '../../../assets/dvr-controls/dvr_controls.scss'
import { trace } from '@gcorevideo/utils'

const T = 'plugins.dvr_controls'

/**
 * Adds the DVR controls to the media control UI
 * @beta
 *
 * @remarks
 * Depends on:
 *
 * - {@link MediaControl}
 *
 * The plugin renders the live stream indicator and the DVR seek bar, if DVR is enabled, in the media control UI.
 */
export class DvrControls extends UICorePlugin {
  private static readonly template = template(dvrHTML)

  /**
   * @internal
   */
  get name() {
    return 'dvr_controls'
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
  override get events() {
    return {
      'click .live-button': 'click',
    }
  }

  /**
   * @internal
   */
  override get attributes() {
    return {
      class: 'dvr-controls',
      'data-dvr-controls': '',
    }
  }

  constructor(core: Core) {
    super(core)
    this.settingsUpdate()
  }

  /**
   * @internal
   */
  override bindEvents() {
    const mediaControl = this.core.getPlugin('media_control')
    assert(mediaControl, 'media_control plugin is required')
    this.listenTo(
      mediaControl,
      Events.MEDIACONTROL_RENDERED,
      this.settingsUpdate,
    )
    this.listenTo(this.core, Events.CORE_OPTIONS_CHANGE, this.render)
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.bindContainerEvents,
    )
  }

  private bindContainerEvents() {
    this.listenToOnce(
      this.core.activeContainer,
      Events.CONTAINER_TIMEUPDATE,
      this.render,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_PLAYBACKDVRSTATECHANGED,
      this.onDvrChanged,
    )
  }

  private onDvrChanged(dvrEnabled: boolean) {
    trace(`${T} onDvrChanged`, {
      dvrEnabled,
    })
    if (this.core.getPlaybackType() !== Playback.LIVE) {
      return
    }
    this.settingsUpdate()
    this.core.mediaControl.$el.addClass('live')
    if (dvrEnabled) {
      // TODO
      this.core.mediaControl.$el
        .addClass('dvr')
        .find(
          '.media-control-indicator[data-position], .media-control-indicator[data-duration]',
        )
        .hide()
    } else {
      this.core.mediaControl.$el.removeClass('dvr')
    }
  }

  private click() {
    const mediaControl = this.core.getPlugin('media_control')
    const container = this.core.activeContainer

    if (!container.isPlaying()) {
      container.play()
    }

    if (mediaControl.$el.hasClass('dvr')) {
      container.seek(container.getDuration())
    }
  }

  private settingsUpdate() {
    // @ts-ignore
    this.stopListening() // TODO sort out
    this.core.getPlugin('media_control').$el.removeClass('live') // TODO don't access directly
    if (this.shouldRender()) {
      this.render()
      this.$el.click(() => this.click())
    }
    this.bindEvents()
  }

  private shouldRender() {
    const useDvrControls =
      this.core.options.useDvrControls === undefined ||
      !!this.core.options.useDvrControls

    return useDvrControls && this.core.getPlaybackType() === Playback.LIVE
  }

  /**
   * @internal
   */
  override render() {
    trace(`${T} render`, {
      dvrEnabled: this.core.activePlayback?.dvrEnabled,
    })
    if (!this.shouldRender()) {
      return this
    }
    this.$el.html(
      DvrControls.template({
        live: this.core.i18n.t('live'),
        backToLive: this.core.i18n.t('back_to_live'),
      }),
    )
    const mediaControl = this.core.getPlugin('media_control')
    assert(mediaControl, 'media_control plugin is required')
    // TODO don't tap into the $el directly
    mediaControl.$el.addClass('live')
    mediaControl
      .$('.media-control-left-panel[data-media-control]')
      .append(this.$el)

    return this
  }
}
