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
import { ExtendedEvents } from '../media-control/MediaControl.js'
import { mediaControlClickaway } from '../../utils/clickaway.js'

const VERSION: string = '2.19.14'

const LOCAL_STORAGE_CC_ID = 'gplayer.plugins.cc.selected'

const T = 'plugins.cc'

/**
 * Configuration options for the {@link ClosedCaptions} plugin.
 * @public
 */
export type ClosedCaptionsPluginSettings = {
  /**
   * Initially selected subtitles language.
   */
  language?: string

  /**
   * Whether to use builtin subtitles.
   */
  mode?: 'native' | 'custom'
}

/**
 * `PLUGIN` that provides a UI to select the subtitles when available.
 * @public
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
 *
 * Known issues:
 *
 * 1. When media source changes, the subtitles tracks aren't reloaded. Possible solution: use `playback.recycleVideo = false`
 * {@link PlayerConfig | main config option}, which will force new video element creation every time media source changes.
 * However, this may lead to other issues, such as autoplay not working (after media source has been changed).
 * {@link https://github.com/video-dev/hls.js/issues/2198 | related discussion}
 *
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

  private active = false

  private open = false

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

  private static readonly templateControl = template(comboboxHTML)

  private static readonly templateLine = template(stringHTML)

  /**
   * @internal
   */
  override get attributes() {
    return {
      class: 'media-control-cc media-control-dd__wrap',
    }
  }

  /**
   * @internal
   */
  override get events() {
    return {
      'click #gplayer-cc-menu [data-item]': 'onItemSelect',
      'click #gplayer-cc-button': 'toggleMenu',
    }
  }

  private get preselectedLanguage(): string | undefined {
    return (
      this.core.options.cc?.language ??
      this.core.options.subtitles?.language
    )
  }

  private isPreselectedLanguage(language: string): boolean {
    if (!this.preselectedLanguage) {
      return false
    }
    return language.startsWith(this.preselectedLanguage)
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.onCoreReady)
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.onContainerChanged,
    )
  }

  private onCoreReady() {
    const mediaControl = this.core.getPlugin('media_control')
    assert(mediaControl, 'media_control plugin is required')
    this.listenTo(mediaControl, Events.MEDIACONTROL_RENDERED, this.mount)
    this.listenTo(mediaControl, Events.MEDIACONTROL_HIDE, () => {
      this.hideMenu()
    })
    this.listenTo(
      mediaControl,
      ExtendedEvents.MEDIACONTROL_MENU_COLLAPSE,
      (from: string) => {
        if (from !== this.name) {
          this.hideMenu()
        }
      },
    )
  }

  private onContainerChanged() {
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_FULLSCREEN,
      this.onContainerResize,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_RESIZE,
      this.onContainerResize,
    )
    this.listenTo(this.core.activeContainer, Events.CONTAINER_DESTROYED, () => {
      this.clickaway(null)
    })
    // this.listenTo(
    //   this.core.activeContainer,
    //   'container:advertisement:start',
    //   this.onStartAd,
    // )
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
    this.listenTo(this.core.activeContainer, Events.CONTAINER_CLICK, () => {
      // TODO test
      this.hideMenu()
    })

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

    this.isPreselectedApplied = false
  }

  private onSubtitleAvailable() {
    trace(`${T} onSubtitleAvailable`, {
      tracks: this.core.activePlayback.closedCaptionsTracks.length,
    })
    this.applyTracks()
    this.mount()
  }

  private onSubtitleChanged({ id: changedId }: { id: number }) {
    // ignoring the subtitle selected by the playback engine or user agent
    const id = this.track?.id ?? -1
    trace(`${T} onSubtitleChanged`, {
      changedId,
      id,
    })
    if (id === -1) {
      this.clearSubtitleText()
    }
    this.activateTrack(id)
  }

  private activateTrack(id: number) {
    for (const track of this.tracks) {
      if (track.id === id) {
        if (this.useNativeSubtitles) {
          track.track.mode = 'showing'
        } else {
          track.track.mode = 'hidden'
        }

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
        track.track.mode = 'disabled'
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

  // private onStartAd() {
  //   if (this.active && this.core.activeContainer) {
  //     this.hide()
  //     this.listenTo(
  //       this.core.activeContainer,
  //       'container:advertisement:finish',
  //       this.onFinishAd,
  //     )
  //   }
  // }

  // private onFinishAd() {
  //   this.show()
  //   this.stopListening(
  //     this.core.activeContainer,
  //     'container:advertisement:finish',
  //     this.onFinishAd,
  //   )
  // }

  private onContainerResize() {
    const shouldShow =
      this.core.activeContainer &&
      isFullscreen(this.core.activeContainer.el) &&
      this.track &&
      this.track.track.mode &&
      Browser.isiOS &&
      this.active

    if (shouldShow) {
      this.show()
    }

    try {
      this.resizeFont()
      this.clampPopup()
    } catch (error) {
      reportError(error)
    }
  }

  /**
   * Hides the subtitles menu and the subtitles.
   */
  hide() {
    this.active = false
    this.open = false
    this.renderIcon()
    this.$el.find('#gplayer-cc-menu').hide()
    this.$el.find('#gplayer-cc-button').attr('aria-expanded', 'false')
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
    this.active = true
    this.renderIcon()
    if (
      this.core.activeContainer &&
      isFullscreen(this.core.activeContainer.el) &&
      this.track &&
      this.track.track.mode &&
      (Browser.isiOS || this.useNativeSubtitles)
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

    this.$el.html(
      ClosedCaptions.templateControl({
        tracks: this.tracks ?? [],
        i18n: this.core.i18n,
        current: this.track?.id ?? -1,
      }),
    )
    this.$el.find('#gplayer-cc-menu').hide()
    this.open = false
    this.core.activeContainer.$el.find('#gplayer-cc-line').remove()
    this.$line = $(ClosedCaptions.templateLine())
    this.resizeFont()
    this.clampPopup()

    this.core.activeContainer.$el.append(this.$line)

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
    const trackId = item?.id ?? -1
    this.core.activePlayback.closedCaptionsTrackId = trackId

    this.updateSelection()

    this.activateTrack(trackId)
  }

  private onItemSelect(event: MouseEvent) {
    // event.target does not exist for some reason in tests
    const id =
      ((event.target ?? event.currentTarget) as HTMLElement).dataset?.item ??
      '-1'

    localStorage.setItem(LOCAL_STORAGE_CC_ID, id) // TODO store language instead?
    this.selectItem(this.findById(Number(id)))
    this.hideMenu()
    return false
  }

  private applyPreselectedSubtitles() {
    if (!this.isPreselectedApplied) {
      this.isPreselectedApplied = true
      // if the language is undefined, then let the engine decide
      // to hide the subtitles forcefully, set the language to 'none'
      setTimeout(() => {
        this.selectItem(
          this.tracks.find(
            (t) => this.isPreselectedLanguage(t.track.language),
          ) ?? null,
        )
      }, 0)
    }
  }

  private hideMenu() {
    this.open = false
    this.$el.find('#gplayer-cc-menu').hide()
    this.$el.find('#gplayer-cc-button').attr('aria-expanded', 'false')
    this.setKeepVisible(false)
  }

  private toggleMenu() {
    this.core
      .getPlugin('media_control')
      .trigger(ExtendedEvents.MEDIACONTROL_MENU_COLLAPSE, this.name)
    this.open = !this.open
    if (this.open) {
      this.$el.find('#gplayer-cc-menu').show()
    } else {
      this.$el.find('#gplayer-cc-menu').hide()
    }
    this.$el.find('#gplayer-cc-button').attr('aria-expanded', this.open)
    this.setKeepVisible(this.open)
  }

  private setKeepVisible(keepVisible: boolean) {
    this.core.getPlugin('media_control').setKeepVisible(keepVisible)
    this.clickaway(keepVisible ? this.core.activeContainer.$el[0] : null)
  }

  private itemElement(id: number): ZeptoResult {
    // TODO fix semantically
    return this.$el.find(`#gplayer-cc-menu [data-item="${id}"]`).parent()
  }

  private allItemElements(): ZeptoResult {
    return this.$el.find('#gplayer-cc-menu li') // TODO fix semantically
  }

  private selectSubtitles() {
    const trackId = this.track ? this.track.id : -1

    // TODO find out if this is needed
    this.core.activePlayback.closedCaptionsTrackId = trackId
    // this.core.activePlayback.closedCaptionsTrackId = -1
  }

  private getSubtitleText(track: TextTrack) {
    const currentTime = this.core.activePlayback?.getCurrentTime() ?? 0
    const cues = track.cues
    const lines = []

    if (cues && cues.length) {
      for (const cue of cues) {
        if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
          lines.push((cue as VTTCue).getCueAsHTML().textContent)
          // TODO break?
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
      .attr('aria-checked', 'false')

    const currentLevelElement = this.itemElement(
      this.track ? this.track.id : -1,
    )
    currentLevelElement
      .addClass('current')
      .find('a')
      .addClass('gcore-skin-active')
      .attr('aria-checked', 'true')
  }

  private renderIcon() {
    // render both icons at once
    const icon = this.active ? subtitlesOnIcon : subtitlesOffIcon
    this.$el.find('#gplayer-cc-button').html(icon)
  }

  private clampPopup() {
    const availableHeight = this.core
      .getPlugin('media_control')
      .getAvailablePopupHeight()
    this.$el.find('#gplayer-cc-menu').css('max-height', `${availableHeight}px`)
  }

  private mount() {
    if (this.shouldRender()) {
      const mediaControl = this.core.getPlugin('media_control')
      mediaControl.slot('cc', this.$el)
    }
  }

  private get useNativeSubtitles() {
    if (this.core.activePlayback?.name === 'dash') {
      return true
    }
    const mode = this.core.options.cc?.mode ?? this.core.options.subtitles?.mode ?? 'custom'
    // TODO or Safari? or iOS?
    return mode === 'native'
  }

  private clickaway = mediaControlClickaway(() => this.hideMenu())
}
