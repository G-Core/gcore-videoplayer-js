import { Core, Events, Playback, UICorePlugin, template } from '@clappr/core'
import assert from 'assert'

import { CLAPPR_VERSION } from '../../build.js'

import dvrHTML from '../../../assets/dvr-controls/index.ejs'
import '../../../assets/dvr-controls/dvr_controls.scss'
import { trace } from '@gcorevideo/utils'
import { MediaControl } from '../media-control/MediaControl.js'

const T = 'plugins.dvr_controls'

/**
 * `PLUGIN` that adds the DVR controls to the media control UI
 *
 * @beta
 *
 * @remarks
 * Depends on:
 *
 * - {@link MediaControl}
 *
 * The plugin renders live stream indicator.
 * If DVR is enabled, the indicator shows whether the current position is at the live edge of the stream or not.
 * In the latter case, the indicator can be clicked to seek to the live edge.
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

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.onCoreReady)
    this.listenTo(this.core, Events.CORE_OPTIONS_CHANGE, this.render)
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.bindContainerEvents,
    )
  }

  private onCoreReady() {
    const mediaControl = this.core.getPlugin('media_control')
    assert(mediaControl, 'media_control plugin is required')
    this.listenTo(
      mediaControl,
      Events.MEDIACONTROL_RENDERED,
      this.settingsUpdate,
    )
    this.settingsUpdate()
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

  private onDvrChanged(dvrInUse: boolean) {
    trace(`${T} onDvrChanged`, {
      dvrInUse,
    })
    if (this.core.getPlaybackType() !== Playback.LIVE) {
      return
    }
    this.render()
    const mediaControl = this.core.getPlugin('media_control')
    mediaControl.$el.addClass('live')
    if (dvrInUse) {
      mediaControl.$el
        .addClass('dvr')
        .find(
          // TODO add API, test
          '.media-control-indicator[data-position], .media-control-indicator[data-duration]',
        )
        .hide()
    } else {
      mediaControl.$el.removeClass('dvr')
    }
  }

  private click() {
    const container = this.core.activeContainer
    if (!container.isPlaying()) {
      container.play()
    }
    container.seek(container.getDuration())
  }

  private settingsUpdate() {
    this.core.getPlugin('media_control').$el.removeClass('live')
    this.render()
  }

  private shouldRender() {
    const useDvrControls = this.core.options.useDvrControls !== false
    return useDvrControls && this.core.getPlaybackType() === Playback.LIVE
  }

  /**
   * @internal
   */
  override render() {
    trace(`${T} render`, {
      dvrEnabled: this.core.activePlayback?.dvrEnabled,
      playbackType: this.core.getPlaybackType(),
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
    const mediaControl = this.core.getPlugin('media_control') as MediaControl
    mediaControl.$el.addClass('live')
    mediaControl.getLeftPanel().append(this.$el)

    return this
  }
}
