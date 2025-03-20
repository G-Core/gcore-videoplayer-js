import { Events, UICorePlugin, Browser, template, $ } from '@clappr/core'
import { reportError, trace } from '@gcorevideo/utils'
import assert from 'assert'

import { CLAPPR_VERSION } from '../../build.js'
import type { TextTrackItem } from '../../internal.types.js'

import '../../../assets/subtitles/style.scss'
import subtitlesOffIcon from '../../../assets/icons/new/subtitles-off.svg'
import subtitlesOnIcon from '../../../assets/icons/new/subtitles-on.svg'
import comboboxHTML from '../../../assets/subtitles/combobox.ejs'
import stringHTML from '../../../assets/subtitles/string.ejs'

import { isFullscreen } from '../utils/fullscreen.js'
import type { ZeptoResult } from '../../types.js'

const VERSION: string = '2.19.14'

const LOCAL_STORAGE_CC_ID = 'gplayer.plugins.cc.selected'

const T = 'plugins.cc'

/**
 * Configuration options for the {@link ClosedCaptions} plugin.
 * @beta
 */
export type ClosedCaptionsPluginSettings = {
  /**
   * Initially selected subtitles language.
   */
  language?: string
}

/**
 * `PLUGIN` that provides a UI to select the subtitles when available.
 * @beta
 *
 * @remarks
 * The plugin is activated when closed captions tracks are detected in the media source.
 * It shows a familiar "CC" button with a dropdown menu to select the subtitles language.
 *
 * Depends on:
 *
 * - {@link MediaControl}
 *
 * Configuration options -  {@link ClosedCaptionsPluginSettings}
 * @example
 * ```ts
 * import { ClosedCaptions } from '@gcorevideo/player'
 *
 * Player.registerPlugin(ClosedCaptions)
 *
 * new Player({
 *   ...
 *   cc: {
 *     language: 'pt-BR',
 *   },
 * })
 * ```
 */
export class ClosedCaptions extends UICorePlugin {
  private isPreselectedApplied = false

  private isShowing = false

  private track: TextTrackItem | null = null

  private tracks: TextTrackItem[] = []

  private $line: ZeptoResult | null = null

  /**
   * @internal
   */
  get name() {
    return 'cc'
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

  private static readonly template = template(comboboxHTML)

  private static readonly templateString = template(stringHTML)

  /**
   * @internal
   */
  override get attributes() {
    return {
      class: 'media-control-cc',
    }
  }

  /**
   * @internal
   */
  override get events() {
    return {
      'click [data-cc-select]': 'onItemSelect',
      'click [data-cc-button]': 'toggleMenu',
    }
  }

  private get preselectedLanguage(): string {
    return this.core.options.cc?.language ?? this.core.options.subtitles?.language ?? ''
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.onCoreReady)
    this.listenTo(this.core, Events.CORE_RESIZE, this.playerResize)
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.onContainerChanged,
    )
  }

  private onCoreReady() {
    trace(`${T} onCoreReady`)
    const mediaControl = this.core.getPlugin('media_control')
    assert(mediaControl, 'media_control plugin is required')
    this.listenTo(mediaControl, Events.MEDIACONTROL_RENDERED, this.render)
    this.listenTo(
      mediaControl,
      Events.MEDIACONTROL_HIDE,
      this.hideMenu,
    )
  }

  private onContainerChanged() {
    trace(`${T} onContainerChanged`)
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_FULLSCREEN,
      this.playerResize,
    )
    this.listenTo(
      this.core.activeContainer,
      'container:advertisement:start',
      this.onStartAd,
    )
    this.listenTo(
      this.core.activePlayback,
      Events.PLAYBACK_SUBTITLE_AVAILABLE,
      this.onSubtitleAvailable,
    )
    this.listenTo(
      this.core.activePlayback,
      Events.PLAYBACK_SUBTITLE_CHANGED,
      this.onSubtitleChanged,
    )

    // fix for iOS
    const video = this.core.activePlayback.el
    assert(video, 'video element is required')

    video.addEventListener('webkitbeginfullscreen', () => {
      if (Browser.isiOS) {
        video.classList.add('ios-fullscreen')
      }
    })

    video.addEventListener('webkitendfullscreen', () => {
      if (Browser.isiOS) {
        video.classList.remove('ios-fullscreen')
      }
    })
  }

  private onSubtitleAvailable() {
    trace(`${T} onSubtitleAvailable`)
    this.applyTracks()
  }

  private onSubtitleChanged({ id }: { id: number }) {
    trace(`${T} onSubtitleChanged`, { id })
    if (id === -1) {
      this.clearSubtitleText()
    }
    for (const track of this.tracks) {
      if (track.id === id) {
        track.track.mode = 'showing'

        this.setSubtitleText(this.getSubtitleText(track.track))

        track.track.oncuechange = (e) => {
          try {
            if (track.track.activeCues?.length) {
              const html = (track.track.activeCues[0] as VTTCue).getCueAsHTML()

              this.setSubtitleText(html)
            } else {
              this.clearSubtitleText()
            }
          } catch (error) {
            reportError(error)
          }
        }
      } else {
        track.track.oncuechange = null
        track.track.mode = 'hidden'
      }
    }
  }

  private applyTracks() {
    try {
      this.tracks = this.core.activePlayback.closedCaptionsTracks
      this.applyPreselectedSubtitles()
      this.render()
    } catch (error) {
      reportError(error)
    }
  }

  private onStartAd() {
    if (this.isShowing && this.core.activeContainer) {
      this.hide()
      this.listenTo(
        this.core.activeContainer,
        'container:advertisement:finish',
        this.onFinishAd,
      )
    }
  }

  private onFinishAd() {
    this.show()
    this.stopListening(
      this.core.activeContainer,
      'container:advertisement:finish',
      this.onFinishAd,
    )
  }

  private playerResize() {
    trace(`${T} playerResize`)
    const shouldShow =
      this.core.activeContainer &&
      isFullscreen(this.core.activeContainer.el) &&
      this.track &&
      this.track.track.mode &&
      Browser.isiOS &&
      this.isShowing

    if (shouldShow) {
      this.show()
    }

    try {
      this.resizeFont()
    } catch (error) {
      reportError(error)
    }
  }

  /**
   * Hides the subtitles menu and the subtitles.
   */
  hide() {
    this.isShowing = false
    this.renderIcon()
    this.$line.hide()
    if (this.tracks) {
      for (const t of this.tracks) {
        t.track.mode = 'hidden'
      }
    }
  }

  /**
   * Shows the subtitles menu and the subtitles.
   */
  show() {
    this.isShowing = true
    this.renderIcon()
    if (
      this.core.activeContainer &&
      isFullscreen(this.core.activeContainer.el) &&
      this.track &&
      this.track.track.mode &&
      Browser.isiOS
    ) {
      this.$line.hide()
      this.track.track.mode = 'showing'
    } else {
      this.$line.show()
    }
  }

  private shouldRender() {
    return this.tracks?.length > 0
  }

  private resizeFont() {
    if (!this.$line) {
      return
    }

    const skinWidth = this.core.activeContainer.$el.width()

    this.$line.find('p').css('font-size', skinWidth * 0.03)
  }

  /**
   * @internal
   */
  override render() {
    if (!this.core.activeContainer) {
      return this
    }

    if (!this.shouldRender()) {
      return this
    }

    const mediaControl = this.core.getPlugin('media_control')

    this.$el.html(ClosedCaptions.template({ tracks: this.tracks }))
    this.core.activeContainer.$el.find('#cc-line').remove()
    this.$line = $(ClosedCaptions.templateString())
    this.resizeFont()

    this.core.activeContainer.$el.append(this.$line)
    mediaControl.mount('cc', this.$el)

    this.updateSelection()

    this.renderIcon()

    return this
  }

  private findById(id: number) {
    return this.tracks.find((track) => track.id === id) ?? null
  }

  private selectItem(item: TextTrackItem | null) {
    this.clearSubtitleText()
    this.track = item

    this.hideMenu()
    this.updateSelection()
  }

  private onItemSelect(event: MouseEvent) {
    const id = (event.target as HTMLElement).dataset.ccSelect ?? '-1'

    trace(`${T} onItemSelect`, { id })

    localStorage.setItem(LOCAL_STORAGE_CC_ID, id)
    this.selectItem(this.findById(Number(id)))

    return false
  }

  private applyPreselectedSubtitles() {
    if (!this.isPreselectedApplied) {
      this.isPreselectedApplied = true
      if (!this.preselectedLanguage) {
        return
      }
      setTimeout(() => {
        this.selectItem(
          this.tracks.find(
            (t) => t.track.language === this.preselectedLanguage,
          ) ?? null,
        )
      }, 300) // TODO why delay?
    }
  }

  private hideMenu() {
    ;(this.$('[data-cc] ul') as ZeptoResult).hide()
  }

  private toggleMenu() {
    trace(`${T} toggleMenu`)
    ;(this.$('[data-cc] ul') as ZeptoResult).toggle()
  }

  private itemElement(id: number): ZeptoResult {
    return (
      this.$(`ul li a[data-cc-select="${id}"]`) as ZeptoResult
    ).parent()
  }

  private allItemElements(): ZeptoResult {
    return this.$('[data-cc] li')
  }

  private selectSubtitles() {
    const trackId = this.track ? this.track.id : -1

    this.core.activePlayback.closedCaptionsTrackId = trackId
  }

  private getSubtitleText(track: TextTrack) {
    const currentTime = this.core.activePlayback?.getCurrentTime() ?? 0
    const cues = track.cues
    const lines = []

    if (cues && cues.length) {
      for (const cue of cues) {
        if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
          lines.push((cue as VTTCue).getCueAsHTML().textContent)
        }
      }
    }

    return lines.join('\n')
  }

  private setSubtitleText(text: string | DocumentFragment) {
    this.$line.find('p').html(text)
  }

  private clearSubtitleText() {
    this.setSubtitleText('')
  }

  private updateSelection() {
    if (!this.track) {
      this.hide()
    } else {
      this.show()
    }
    this.selectSubtitles()
    this.highlightCurrentSubtitles()
  }

  private highlightCurrentSubtitles() {
    this.allItemElements()
      .removeClass('current')
      .find('a')
      .removeClass('gcore-skin-active')

    trace(`${T} highlightCurrentSubtitles`, {
      track: this.track?.id,
    })
    const currentLevelElement = this.itemElement(this.track ? this.track.id : -1)
    currentLevelElement
      .addClass('current')
      .find('a')
      .addClass('gcore-skin-active')
  }

  private renderIcon() {
    const icon = this.isShowing ? subtitlesOnIcon : subtitlesOffIcon

    this.$el.find('span.cc-text').html(icon)
  }
}
