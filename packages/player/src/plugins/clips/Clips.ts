import { Container, Events, UICorePlugin, $, template } from '@clappr/core'
// import { trace } from '@gcorevideo/utils'
import assert from 'assert'

import { TimeProgress, TimeValue } from '../../playback.types.js'
import type { ZeptoResult } from '../../types.js'
import '../../../assets/clips/clips.scss'
import { ClipDesc } from './types.js'
import { buildSvg, parseClips } from './utils.js'
import clipsHTML from '../../../assets/clips/clips.ejs'

// const T = 'plugins.clips'

/**
 * Configuration options for the {@link Clips} plugin.
 * @public
 */
export interface ClipsPluginSettings {
  /**
   * The compiled text of the clips description, one clip per line in format:
   * `HH:MM:SS text` or `MM:SS text` or `SS text`
   */
  text: string
}

const VERSION = '2.22.16'
const CLAPPR_VERSION = '0.11.4'

const COMPACT_WIDTH = 495

/**
 * `PLUGIN` that allows marking up the timeline of the video
 * @public
 * @remarks
 * The plugin decorates the seekbar with notches to indicate the clips of the video and displays current clip text in the left panel
 *
 * Depends on:
 *
 * - {@link MediaControl}
 *
 * Configuration options - {@link ClipsPluginSettings}
 */
export class Clips extends UICorePlugin {
  private barStyle: HTMLStyleElement | null = null

  private clips: ClipDesc[] = []

  private oldContainer: Container | undefined

  private svgMask: ZeptoResult | null = null

  private static readonly template = template(clipsHTML)

  /**
   * @internal
   */
  get name() {
    return 'clips'
  }

  /**
   * @internal
   */
  override get attributes() {
    return {
      class: 'gplayer-mc-clips',
    }
  }

  get version() {
    return VERSION
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenToOnce(this.core, Events.CORE_READY, this.onCoreReady)
    this.listenTo(this.core, Events.CORE_RESIZE, this.playerResize)
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.onContainerChanged,
    )
  }

  override render() {
    if (!this.options.clips) {
      return this
    }
    this.$el.html(Clips.template())
    this.$el.hide()
    return this
  }

  override destroy() {
    if (this.barStyle) {
      this.barStyle.remove()
      this.barStyle = null
    }
    return super.destroy()
  }

  override disable() {
    if (this.barStyle) {
      this.barStyle.remove()
      this.barStyle = null
    }
    return super.disable()
  }

  override enable() {
    this.render()
    return super.enable()
  }

  /**
   * Get the text of the clip at the given time
   * @param time - The time to get the text for
   * @returns The text of the clip at the given time
   */
  getText(time: TimeValue): string | undefined {
    return this.clips.find((clip) => clip.start <= time && clip.end >= time)
      ?.text
  }

  private onCoreReady() {
    const mediaControl = this.core.getPlugin('media_control')
    assert(mediaControl, 'media_control plugin is required')

    this.parseClips(this.options.clips.text)
    this.listenTo(mediaControl, Events.MEDIACONTROL_RENDERED, this.onMcRender)
  }

  private onMcRender() {
    this.core.getPlugin('media_control')?.slot('clips', this.$el)
  }

  private onContainerChanged() {
    // TODO figure out the conditions of changing the container (without destroying the previous one)
    // probably it is the case with the MultiCamera plugin
    if (this.oldContainer) {
      this.stopListening(
        this.oldContainer,
        Events.CONTAINER_TIMEUPDATE,
        this.onTimeUpdate,
      )
    }
    this.oldContainer = this.core.activeContainer
    if (this.svgMask) {
      this.svgMask.remove()
      this.svgMask = null
    }
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_TIMEUPDATE,
      this.onTimeUpdate,
    )
    this.toggleCompact()
  }

  private playerResize() {
    const duration = this.core.activeContainer.getDuration()
    // TODO check
    if (duration) {
      this.makeSvg(duration)
    }
    this.toggleCompact()
  }

  private toggleCompact() {
    const elText = this.$el.find('#gplayer-mc-clips-text')
    if (this.core.activeContainer.el.clientWidth <= COMPACT_WIDTH) {
      elText.addClass('compact')
    } else {
      elText.removeClass('compact')
    }
  }

  private onTimeUpdate(event: TimeProgress) {
    if (!this.svgMask) {
      this.makeSvg(event.total)
    }
    for (const value of this.clips) {
      if (
        (event.current >= value.start && !value.end) ||
        event.current < value.end
      ) {
        this.setClipText(value.text)
        break
      }
    }
  }

  private parseClips(text: string) {
    this.clips = parseClips(text)
  }

  private makeSvg(duration: number) {
    const svg = buildSvg(
      this.clips,
      duration,
      this.core.activeContainer.$el.width(),
    )
    this.setSVGMask(svg)
  }

  private setSVGMask(svg: string) {
    if (this.svgMask) {
      this.svgMask.remove()
    }

    this.svgMask = $(svg)
    this.$el.append(this.svgMask)
    if (!this.barStyle) {
      this.barStyle = document.createElement('style')
      this.barStyle.textContent = `
.bar-container[data-seekbar] {
  clip-path: url("#myClip");
}`
      this.$el.append(this.barStyle)
    }
  }

  private setClipText(text: string) {
    if (text) {
      this.$el.show().find('#gplayer-mc-clips-text').text(text)
    } else {
      this.$el.hide()
    }
  }
}
