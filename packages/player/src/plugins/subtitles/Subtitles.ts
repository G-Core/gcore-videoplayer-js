import {
  Events,
  UICorePlugin,
  Browser,
  template,
  $,
} from '@clappr/core'
import { reportError, trace } from '@gcorevideo/utils'
import assert from 'assert'

import { CLAPPR_VERSION } from '../../build.js'

import '../../../assets/subtitles/style.scss'
import subtitlesOffIcon from '../../../assets/icons/new/subtitles-off.svg'
import subtitlesOnIcon from '../../../assets/icons/new/subtitles-on.svg'
import comboboxHTML from '../../../assets/subtitles/combobox.ejs'
import stringHTML from '../../../assets/subtitles/string.ejs'

import { isFullscreen } from '../utils.js'
import type { ZeptoResult } from '../../types.js'

const VERSION: string = '2.19.14'

const LOCAL_STORAGE_SUBTITLES_ID =
  'gplayer.plugins.subtitles.selected'

const T = 'plugins.subtitles'

type TextTrackInfo = {
  language: string
  mode?: 'showing' | 'hidden' | 'disabled'
}

const NO_TRACK = { language: 'off' }

/**
 * A {@link MediaControl | media control} plugin that provides a UI to select the subtitles when available.
 * @beta
 *
 * @remarks
 * Depends on:
 *
 * - {@link MediaControl}
 *
 * Configuration options:
 *
 * - subtitles.language - The language of the subtitles to select by default.
 *
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
  private currentLevel: TextTrackInfo | null = null

  private isPreselectedApplied = false

  private isShowing = false

  private track: TextTrackInfo = { ...NO_TRACK }

  private tracks: TextTrackList | null = null

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
      class: this.name,
      'data-subtitles': '',
    }
  }

  /**
   * @internal
   */
  override get events() {
    return {
      'click [data-subtitles-select]': 'onLevelSelect',
      'click [data-subtitles-button]': 'onShowLevelSelectMenu',
    }
  }

  private get preselectedLanguage(): string {
    return this.core.options.subtitles?.language ?? 'off'
  }

  /**
   * @internal
   */
  override bindEvents() {
    const mediaControl = this.core.getPlugin('media_control')
    assert(mediaControl, 'media_control plugin is required')
    this.listenTo(this.core, Events.CORE_RESIZE, this.playerResize)
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.bindPlaybackEvents,
    )
    this.listenTo(mediaControl, Events.MEDIACONTROL_RENDERED, this.render)
    this.listenTo(
      mediaControl,
      Events.MEDIACONTROL_HIDE,
      this.hideSelectLevelMenu,
    )
  }

  private bindPlaybackEvents() {
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_FULLSCREEN,
      this.playerResize,
    )
    this.listenToOnce(
      this.core.activePlayback,
      Events.PLAYBACK_PLAY,
      this.getTracks,
    )
    this.listenTo(
      this.core.activeContainer,
      'container:advertisement:start',
      this.onStartAd,
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

  private getTracks() {
    if (this.core.activePlayback) {
      try {
        const tracks = (this.core.activePlayback.el as HTMLMediaElement)
          .textTracks
        if (tracks.length > 0) {
          this.setTracks(tracks)
        }
      } catch (error) {
        reportError(error)
      }
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
    const shouldShow =
      this.core.activeContainer &&
      isFullscreen(this.core.activeContainer.el) &&
      this.currentLevel &&
      this.currentLevel.mode &&
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
        t.mode = 'hidden'
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
      this.currentLevel &&
      this.currentLevel.mode &&
      Browser.isiOS
    ) {
      this.$string.hide()
      this.currentLevel.mode = 'showing'
    } else {
      this.$string.show()
    }
  }

  private shouldRender() {
    return !!(this.tracks && this.tracks.length > 0)
  }

  private resizeFont() {
    if (!this.core.activeContainer) {
      return
    }

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

    trace(`${T} render`, {
      tracks: this.tracks?.length,
      track: this.track?.language,
    })

    const mediaControl = this.core.getPlugin('media_control')
    assert(mediaControl, 'media_control plugin is required')

    this.$el.html(Subtitles.template({ tracks: this.tracks }))
    this.core.activeContainer.$el.find('.subtitle-string').remove()
    this.$string = $(Subtitles.templateString())
    this.resizeFont()

    this.core.activeContainer.$el.append(this.$string[0])
    const ss = mediaControl.getElement('subtitlesSelector')
    if (ss && ss.length > 0) {
      ss.append(this.el)
    } else {
      mediaControl.getRightPanel().append(this.el)
    }

    this.updateCurrentLevel(this.track)
    this.highlightCurrentSubtitles()

    this.applyPreselectedSubtitles()

    this.renderIcon()

    return this
  }

  private setTracks(tracks: TextTrackList) {
    this.tracks = tracks
    this.render()
  }

  private findLevelBy(id: string) {
    if (this.tracks) {
      for (const track of this.tracks) {
        if (track.language === id) {
          return track // TODO TrackInfo?
        }
      }
    }
  }

  private selectLevel(id: string) {
    this.clearSubtitleText()
    this.track = this.findLevelBy(id) || { ...NO_TRACK }

    this.hideSelectLevelMenu()
    if (!this.track) {
      this.track = { language: 'off' }
    }

    this.updateCurrentLevel(this.track)
  }

  private onLevelSelect(event: MouseEvent) {
    const id = (event.target as HTMLElement).dataset.subtitlesSelect

    if (id) {
      localStorage.setItem(LOCAL_STORAGE_SUBTITLES_ID, id)
      this.selectLevel(id)
    }

    return false
  }

  private applyPreselectedSubtitles() {
    if (!this.isPreselectedApplied) {
      this.isPreselectedApplied = true
      setTimeout(() => {
        this.selectLevel(this.preselectedLanguage)
      }, 300)
    }
  }

  private onShowLevelSelectMenu() {
    trace(`${T} onShowLevelSelectMenu`)
    this.toggleContextMenu()
  }

  private hideSelectLevelMenu() {
    ;(this.$('[data-subtitles] ul') as ZeptoResult).hide()
  }

  private toggleContextMenu() {
    (this.$('[data-subtitles] ul') as ZeptoResult).toggle()
  }

  private buttonElement(): ZeptoResult {
    return this.$('[data-subtitles] button')
  }

  private levelElement(id?: string): ZeptoResult {
    return (
      this.$(
        '[data-subtitles] ul a' + (id ? '[data-subtitles-select="' + id + '"]' : ''),
      ) as ZeptoResult
    ).parent()
  }

  private startLevelSwitch() {
    this.buttonElement().addClass('changing')
  }

  private stopLevelSwitch() {
    this.buttonElement().removeClass('changing')
  }

  private selectSubtitles() {
    if (!this.currentLevel) {
      return
    }

    if (this.tracks) {
      for (let i = 0; i < this.tracks.length; i++) {
        const track = this.tracks[i]
        if (track.language === this.currentLevel.language) {
          track.mode = 'showing'

          const currentTime = this.core.activePlayback?.getCurrentTime() ?? 0
          const cues = track.cues
          let subtitleText = ''

          if (cues && cues.length) {
            for (const cue of cues) {
              if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
                subtitleText +=
                  (cue as VTTCue).getCueAsHTML().textContent + '\n'
              }
            }
          }

          this.setSubtitleText(subtitleText)

          track.oncuechange = (e) => {
            try {
              if (track.activeCues?.length) {
                const html = (track.activeCues[0] as VTTCue).getCueAsHTML()

                this.setSubtitleText(html)
              } else {
                this.clearSubtitleText()
              }
            } catch (error) {
              // console.error(error);
              reportError(error)
            }
          }
          continue
        }
        this.tracks[i].oncuechange = null
        this.tracks[i].mode = 'hidden'
      }
    }
  }

  private setSubtitleText(text: string | DocumentFragment) {
    this.$string.find('p').html(text)
  }

  private clearSubtitleText() {
    this.setSubtitleText('')
  }

  private updateCurrentLevel(track: TextTrackInfo) {
    this.currentLevel = track
    if (track.language === 'off') {
      this.hide()
    } else {
      this.show()
    }
    this.selectSubtitles()
    this.highlightCurrentSubtitles()
  }

  private highlightCurrentSubtitles() {
    this.levelElement().removeClass('current')
    this.levelElement().find('a').removeClass('gcore-skin-active')

    if (this.currentLevel) {
      const currentLevelElement = this.levelElement(this.currentLevel.language)

      currentLevelElement.addClass('current')
      currentLevelElement.find('a').addClass('gcore-skin-active')
    }
  }

  private renderIcon() {
    const icon = this.isShowing ? subtitlesOnIcon : subtitlesOffIcon

    this.core
      .getPlugin('media_control')
      .getElement('subtitlesSelector')
      ?.find('span.subtitle-text')
      .html(icon)
  }
}
