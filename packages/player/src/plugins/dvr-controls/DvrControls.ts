import { Events, Playback, UICorePlugin, template } from '@clappr/core'
import assert from 'assert'

import { CLAPPR_VERSION } from '../../build.js'

import dvrHTML from '../../../assets/dvr-controls/index.ejs'
import '../../../assets/dvr-controls/dvr_controls.scss'
// import { trace } from '@gcorevideo/utils'
import { MediaControl } from '../media-control/MediaControl.js'

// const T = 'plugins.dvr_controls'

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

    this.listenTo(mediaControl, Events.MEDIACONTROL_RENDERED, this.mount)
  }

  private onActiveContainerChanged() {
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_LOADEDMETADATA,
      this.onMetadataLoaded,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_PLAYBACKDVRSTATECHANGED,
      this.onDvrStateChanged,
    )
  }

  private click() {
    const container = this.core.activeContainer
    if (!container.isPlaying()) {
      container.play()
    }
    container.seek(container.getDuration())
  }

  /**
   * @internal
   */
  override render() {
    this.$el.html(
      DvrControls.template({
        i18n: this.core.i18n,
      }),
    )

    return this
  }

  private onMediacontrolRendered() {
    this.render()
  }

  private onMetadataLoaded() {
    this.mount()
    this.toggleState(this.core.activeContainer.isDvrInUse())
  }

  private mount() {
    // TODO move mount point management logic to MediaControl
    if (this.core.getPlaybackType() !== Playback.LIVE) {
      return
    }
    const mediaControl = this.core.getPlugin('media_control') as MediaControl
    assert(mediaControl, 'media_control plugin is required')
    // TODO -> to MediaControl
    mediaControl.toggleElement('duration', false)
    mediaControl.toggleElement('position', false)
    mediaControl.mount('dvr', this.$el)
  }

  private onDvrStateChanged(dvrInUse: boolean) {
    this.toggleState(dvrInUse)
  }

  private toggleState(dvrInUse: boolean) {
    if (dvrInUse) {
      this.$el.find('#media-control-back-to-live').show()
      this.$el.find('#media-control-live').hide()
    } else {
      this.$el.find('#media-control-back-to-live').hide()
      this.$el.find('#media-control-live').show()
    }
  }
}
