import { UICorePlugin, Browser, Playback, Events, template } from '@clappr/core'
import { trace } from '@gcorevideo/utils'

import { CLAPPR_VERSION } from '../../build.js'

import pluginHtml from '../../../assets/skip-time/skip-time.ejs'
import '../../../assets/skip-time/style.scss'

type Position = 'mid' | 'left' | 'right'

const T = 'plugins.skip_time'

/**
 * `PLUGIN` that allows skipping time by tapping on the left or right side of the video.
 * @beta
 */
export class SkipTime extends UICorePlugin {
  get name() {
    return 'skip_time'
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  get container() {
    return this.core && this.core.activeContainer
  }

  private static readonly template = template(pluginHtml)

  /**
   * @internal
   */
  override get attributes() {
    return {
      class: 'mc-skip-time',
    }
  }

  private position: Position = 'mid'

  /**
   * @internal
   */
  override get events() {
    return {
      'click #mc-skip-left': 'setBack',
      'click #mc-skip-mid': 'setMidClick',
      'click #mc-skip-right': 'setForward',
    }
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.render)
    this.listenTo(this.core, Events.CORE_ACTIVE_CONTAINER_CHANGED, this.onContainerChanged)
  }

  private onContainerChanged() {
    this.listenTo(
      this.container,
      Events.CONTAINER_DBLCLICK,
      this.handleRewindClicks,
    )
    this.mount()
  }

  private setBack() {
    trace(`${T} setBack`)
    this.position = 'left'
  }

  private handleRewindClicks() {
    trace(`${T} handleRewindClicks`, {
      position: this.position,
    })
    if (
      this.core.getPlaybackType() === Playback.LIVE &&
      !this.container.isDvrEnabled()
    ) {
      this.toggleFullscreen()
      return
    }
    this.handleSkip()
  }

  private handleSkip() {
    trace(`${T} handleSkip`, {
      position: this.position,
    })
    if (Browser.isMobile) {
      if (this.position === 'left') {
        const seekPos = this.container.getCurrentTime() - 10

        if (seekPos < 0) {
          return
        }
        this.container.seek(seekPos)
      } else if (this.position === 'right') {
        const seekPos = this.container.getCurrentTime() + 30

        if (seekPos > this.container.getDuration()) {
          return
        }

        this.container.seek(seekPos)
      } else {
        this.toggleFullscreen()
      }
    }
  }

  private setMidClick() {
    trace(`${T} setMidClick`)
    this.position = 'mid'
  }

  private setForward() {
    trace(`${T} setForward`)
    this.position = 'right'
  }

  private toggleFullscreen() {
    trace(`${T} toggleFullscreen`)
    this.trigger(Events.MEDIACONTROL_FULLSCREEN, this.name)
    this.container.fullscreen()
    this.core.toggleFullscreen()
  }

  /**
   * @internal
   */
  override render() {
    trace(`${T} render`)
    this.$el.html(SkipTime.template())

    return this
  }

  private mount() {
    trace(`${T} mount`)
    this.core.activeContainer.$el.append(this.el)
  }
}
