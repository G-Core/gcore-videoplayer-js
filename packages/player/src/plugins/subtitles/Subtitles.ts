import { Events, UICorePlugin, Browser, template, $ } from '@clappr/core'
import { reportError, trace } from '@gcorevideo/utils'
import assert from 'assert'

import { CLAPPR_VERSION } from '../../build.js'
import type { TextTrackItem } from '../../playback.types.js'

import '../../../assets/subtitles/style.scss'
import subtitlesOffIcon from '../../../assets/icons/new/subtitles-off.svg'
import subtitlesOnIcon from '../../../assets/icons/new/subtitles-on.svg'
import comboboxHTML from '../../../assets/subtitles/combobox.ejs'
import stringHTML from '../../../assets/subtitles/string.ejs'

import { isFullscreen } from '../utils.js'
import type { ZeptoResult } from '../../types.js'

const VERSION: string = '2.19.14'

const LOCAL_STORAGE_SUBTITLES_ID = 'gplayer.plugins.subtitles.selected'

const T = 'plugins.subtitles'

export type SubtitlesPluginSettings = {
  /**
   * Initially selected subtitles language
   */
  language?: string
}

/**
 * `PLUGIN` that provides a UI to select the subtitles when available.
 * @beta
 *
 * @remarks
 * Depends on:
 *
 * - {@link MediaControl}
 *
 * Configuration options -  {@link SubtitlesPluginSettings}
 * @example
 * ```ts
 * import { Subtitles } from '@gcorevideo/player'
 *
 * Player.registerPlugin(Subtitles)
 *
 * new Player({
 *   ...
 *   subtitles: {
 *     language: 'en',
 *   },
 * })
 * ```
 */
export class Subtitles extends UICorePlugin {
  private isPreselectedApplied = false

  private isShowing = false

  private track: TextTrackItem | null = null

  private tracks: TextTrackItem[] = []

  private $string: ZeptoResult | null = null

  /**
   * @internal
   */
  get name() {
    return 'subtitles'
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
      class: 'media-control-subtitles',
      'data-subtitles': '',
    }
  }

  /**
   * @internal
   */
  override get events() {
    return {
      'click [data-subtitles-select]': 'onItemSelect',
      'click [data-subtitles-button]': 'toggleMenu',
    }
  }

  private get preselectedLanguage(): string {
    return this.core.options.subtitles?.language ?? ''
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
    this.$string.hide()
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
      this.$string.hide()
      this.track.track.mode = 'showing'
    } else {
      this.$string.show()
    }
  }

  private shouldRender() {
    return this.tracks.length > 0
  }

  private resizeFont() {
    if (!this.$string) {
      return
    }

    const skinWidth = this.core.activeContainer.$el.width()

    this.$string.find('p').css('font-size', skinWidth * 0.03)
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

    this.$el.html(Subtitles.template({ tracks: this.tracks }))
    this.core.activeContainer.$el.find('.subtitle-string').remove()
    this.$string = $(Subtitles.templateString())
    this.resizeFont()

    this.core.activeContainer.$el.append(this.$string)
    mediaControl.putElement('subtitlesSelector', this.$el)

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
    const id = (event.target as HTMLElement).dataset.subtitlesSelect ?? '-1'

    trace(`${T} onItemSelect`, { id })

    localStorage.setItem(LOCAL_STORAGE_SUBTITLES_ID, id)
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
    ;(this.$('[data-subtitles] ul') as ZeptoResult).hide()
  }

  private toggleMenu() {
    ;(this.$('[data-subtitles] ul') as ZeptoResult).toggle()
  }

  private itemElement(id: number): ZeptoResult {
    return (
      this.$(`ul li a[data-subtitles-select="${id}"]`) as ZeptoResult
    ).parent()
  }

  private allItemElements(): ZeptoResult {
    return this.$('[data-subtitles] li')
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
    this.$string.find('p').html(text)
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

    this.$el.find('span.subtitle-text').html(icon)
  }
}
