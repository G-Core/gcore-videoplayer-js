import {
  Container,
  Events,
  Playback,
  UICorePlugin,
  Browser,
  template,
  $,
} from '@clappr/core'
import { type TimeValue } from '@gcorevideo/player'
import { reportError } from '@gcorevideo/utils'
import assert from 'assert'

import { CLAPPR_VERSION } from '../build.js'

import '../../assets/subtitles/style.scss'
import subtitlesOffIcon from '../../assets/icons/new/subtitles-off.svg'
import subtitlesOnIcon from '../../assets/icons/new/subtitles-on.svg'
import comboboxHTML from '../../assets/subtitles/combobox.ejs'
import stringHTML from '../../assets/subtitles/string.ejs'

import { isFullscreen } from '../utils.js'
import type { ZeptoResult } from '../types.js'

const VERSION: string = '0.0.1'

const LOCAL_STORAGE_SUBTITLES_ID = 'subtitles_select'

const T = 'plugins.subtitles'

type TextTrackInfo = {
  language: string
  mode?: 'showing' | 'hidden' | 'disabled'
}

type TimelyPlayback = Playback & {
  getCurrentTime(): TimeValue
}

const NO_TRACK = { language: 'off' }

export class Subtitles extends UICorePlugin {
  private currentContainer: Container | undefined

  private currentLevel: TextTrackInfo | undefined

  private currentPlayback: TimelyPlayback | undefined

  private isShowing = false

  private tracks: TextTrackList | undefined

  private $string: ZeptoResult | undefined

  get name() {
    return 'subtitles'
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  static get version() {
    return VERSION
  }

  get template() {
    return template(comboboxHTML)
  }

  get templateString() {
    return template(stringHTML)
  }

  override get attributes() {
    return {
      class: this.name,
      'data-subtitles': '',
    }
  }

  override get events() {
    return {
      'click [data-subtitles-select]': 'onLevelSelect',
      'click [data-subtitles-button]': 'onShowLevelSelectMenu',
    }
  }

  private isPreselectedApplied = false

  private track: TextTrackInfo = { ...NO_TRACK }

  get preselectedLanguage(): string {
    return this.core.options.subtitles?.language ?? 'off'
  }

  override bindEvents() {
    this.listenTo(this.core, Events.CORE_RESIZE, this.playerResize)
    this.listenToOnce(this.core, Events.CORE_READY, this.bindPlaybackEvents)
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_CONTAINERCHANGED,
      this.reload,
    )
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_RENDERED,
      this.render,
    )
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_HIDE,
      this.hideSelectLevelMenu,
    )
  }

  unBindEvents() {
    // @ts-ignore
    this.stopListening(this.core, Events.CORE_READY)
    // @ts-ignore
    this.stopListening(
      this.core.mediaControl,
      Events.MEDIACONTROL_CONTAINERCHANGED,
    )
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_RENDERED)
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_HIDE)
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_SHOW)
    if (this.currentContainer) {
      // @ts-ignore
      this.stopListening(this.currentContainer, Events.CONTAINER_FULLSCREEN)
      // @ts-ignore
      this.stopListening(
        this.currentContainer,
        'container:advertisement:start',
        this.onStartAd,
      )
      // @ts-ignore
      this.stopListening(
        this.currentContainer,
        'container:advertisement:finish',
        this.onFinishAd,
      )
    }
  }

  private bindPlaybackEvents() {
    if (
      this.currentPlayback &&
      this.currentPlayback === this.core.activePlayback
    ) {
      return
    }

    this.currentPlayback = this.core.activePlayback
    this.currentContainer = this.core.activeContainer

    this.listenTo(
      this.currentContainer,
      Events.CONTAINER_FULLSCREEN,
      this.playerResize,
    )
    this.listenToOnce(
      this.currentPlayback,
      Events.PLAYBACK_PLAY,
      this.getTracks,
    )
    this.listenTo(
      this.currentContainer,
      'container:advertisement:start',
      this.onStartAd,
    )

    // fix for iOS
    const video = this.currentPlayback?.el
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
    if (this.currentPlayback) {
      try {
        const tracks = (this.currentPlayback.el as HTMLMediaElement).textTracks

        tracks.length > 0 && this.fillLevels(tracks)
      } catch (error) {
        reportError(error)
      }
    }
  }

  private onStartAd() {
    if (this.isShowing && this.currentContainer) {
      this.hide()
      this.listenTo(
        this.currentContainer,
        'container:advertisement:finish',
        this.onFinishAd,
      )
    }
  }

  private onFinishAd() {
    this.show()
    this.stopListening(
      this.currentContainer,
      'container:advertisement:finish',
      this.onFinishAd,
    )
  }

  reload() {
    this.unBindEvents()
    this.bindEvents()
    this.bindPlaybackEvents()
  }

  private playerResize() {
    const shouldShow =
      this.currentContainer &&
      isFullscreen(this.currentContainer.el) &&
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

  show() {
    this.isShowing = true
    this.renderIcon()
    if (
      this.currentContainer &&
      isFullscreen(this.currentContainer.el) &&
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
    if (!this.currentContainer) {
      return false
    }

    if (!this.currentPlayback) {
      return false
    }

    // Only care if we have at least 2 to choose from
    const hasLevels = !!(this.tracks && this.tracks.length > 0)

    return hasLevels
  }

  private resizeFont() {
    if (!this.currentContainer) {
      return
    }

    if (!this.$string) {
      return
    }

    const skinWidth = this.currentContainer.$el.width()

    this.$string.find('p').css('font-size', skinWidth * 0.03)
  }

  override render() {
    if (this.shouldRender()) {
      this.$el.html(this.template({ tracks: this.tracks }))
      this.currentContainer?.$el.find('.subtitle-string').remove()
      this.$string = $(this.templateString())
      this.resizeFont()

      this.currentContainer?.$el.append(this.$string[0])
      if (
        this.core.mediaControl.$subtitlesSelector &&
        this.core.mediaControl.$subtitlesSelector.length > 0
      ) {
        this.core.mediaControl.$subtitlesSelector.append(this.el)
      } else {
        this.core.mediaControl.$('.media-control-right-panel').append(this.el)
      }

      this.updateCurrentLevel(this.track)
      this.highlightCurrentSubtitles()

      this.applyPreselectedSubtitles()
    }
    if (
      this.core.mediaControl.$subtitlesSelector?.find('span.subtitle-text')
        .length > 0
    ) {
      this.renderIcon()
    }

    return this
  }

  private fillLevels(tracks: TextTrackList) {
    this.tracks = tracks
    this.render()
  }

  private findLevelBy(id: string) {
    if (this.tracks) {
      for (let i = 0; i < this.tracks.length; i++) {
        if (this.tracks[i].language === id) {
          return this.tracks[i] // TODO TrackInfo?
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
    this.toggleContextMenu()
  }

  private hideSelectLevelMenu() {
    ;(this.$('.subtitles ul') as ZeptoResult).hide()
  }

  private toggleContextMenu() {
    ;(this.$('.subtitles ul') as ZeptoResult).toggle()
  }

  buttonElement(): ZeptoResult {
    return this.$('.subtitles button')
  }

  levelElement(id?: string): ZeptoResult {
    return (
      this.$(
        '.subtitles ul a' + (id ? '[data-subtitles-select="' + id + '"]' : ''),
      ) as ZeptoResult
    ).parent()
  }

  startLevelSwitch() {
    this.buttonElement().addClass('changing')
  }

  stopLevelSwitch() {
    this.buttonElement().removeClass('changing')
  }

  selectSubtitles() {
    if (!this.currentLevel) {
      return
    }

    if (this.tracks) {
      for (let i = 0; i < this.tracks.length; i++) {
        const track = this.tracks[i]
        if (track.language === this.currentLevel.language) {
          track.mode = 'showing'

          const currentTime = this.currentPlayback?.getCurrentTime() ?? 0
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

    this.core.mediaControl.$subtitlesSelector
      .find('span.subtitle-text')
      .html(icon)
  }
}
