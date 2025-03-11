import { Events, UICorePlugin, Playback, template, Core } from '@clappr/core'
import { trace } from '@gcorevideo/utils'
import assert from 'assert'

import { CLAPPR_VERSION } from '../../build.js'
import type { ZeptoResult } from '../../types.js'

import buttonHtml from '../../../assets/playback-rate/button.ejs'
import listHtml from '../../../assets/playback-rate/list.ejs'
import speedIcon from '../../../assets/icons/new/speed.svg'
import arrowRightIcon from '../../../assets/icons/new/arrow-right.svg'
import arrowLeftIcon from '../../../assets/icons/new/arrow-left.svg'
import checkIcon from '../../../assets/icons/new/check.svg'
import { BottomGear } from '../bottom-gear/BottomGear.js'
import { PlaybackEvents } from '../../playback/types.js'
import {
  MediaControl,
  MediaControlEvents,
} from '../media-control/MediaControl.js'

type PlaybackRateOption = {
  value: string
  label: string
}

const DEFAULT_PLAYBACK_RATES = [
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1.0', label: '1x' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
  { value: '1.75', label: '1.75x' },
  { value: '2.0', label: '2x' },
]

const DEFAULT_PLAYBACK_RATE = '1.0'

const T = 'plugins.playback_rate'

/**
 * `PLUGIN` that allows changing the playback speed of the video.
 * @beta
 *
 * @remarks
 * Depends on:
 *
 * - {@link MediaControl | media_control}
 *
 * - {@link BottomGear | bottom_gear}
 *
 * It renders a button in the gear menu, which opens a dropdown with the options to change the playback rate.
 * Note that the playback rate change is supported only for VOD or DVR enabled live streams.
 */
export class PlaybackRate extends UICorePlugin {
  private playbackRates: PlaybackRateOption[] = DEFAULT_PLAYBACK_RATES

  // Saved when an ad starts to restore after it finishes
  private prevSelectedRate: string | undefined

  private rendered = false

  private selectedRate: string = DEFAULT_PLAYBACK_RATE

  /**
   * @internal
   */
  get name() {
    return 'playback_rate'
  }

  /**
   * @internal
   */
  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  private static readonly buttonTemplate = template(buttonHtml)

  private static readonly listTemplate = template(listHtml)

  constructor(core: Core) {
    super(core)
    this.playbackRates =
      core.options.playbackRate?.options || DEFAULT_PLAYBACK_RATES
    this.selectedRate =
      core.options.playbackRate?.defaultValue || DEFAULT_PLAYBACK_RATE
  }

  /**
   * @internal
   */
  override get attributes() {
    return {
      class: 'media-control-playbackrate',
    }
  }

  /**
   * @internal
   */
  override get events() {
    return {
      'click .gear-sub-menu_btn': 'onRateSelect',
      'click .gear-option': 'onShowMenu',
      'click .go-back': 'goBack',
    }
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.onCoreReady)
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.onActiveContainerChange,
    )
  }

  private onCoreReady() {
    trace(`${T} onCoreReady`)
    const mediaControl = this.core.getPlugin('media_control')
    assert(mediaControl, 'media_control plugin is required')
    const gear = this.core.getPlugin('bottom_gear') as BottomGear
    assert(gear, 'bottom_gear plugin is required')
    this.listenTo(
      mediaControl,
      MediaControlEvents.MEDIACONTROL_GEAR_RENDERED,
      this.onGearRendered,
    )
  }

  private onActiveContainerChange() {
    trace(`${T} onActiveContainerChange`)
    this.listenTo(this.core.activePlayback, Events.PLAYBACK_STOP, this.onStop)
    this.listenTo(this.core.activePlayback, Events.PLAYBACK_PLAY, this.onPlay)
    this.listenTo(
      this.core.activePlayback,
      PlaybackEvents.PLAYBACK_RATE_CHANGED,
      this.onPlaybackRateChange,
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_PLAYBACKDVRSTATECHANGED,
      this.onDvrStateChanged,
    )
  }

  private onGearRendered() {
    trace(`${T} onGearRendered`, {
      rendered: this.rendered,
    })
    this.rendered = false
    this.render()
  }

  private onDvrStateChanged(dvrEnabled: boolean) {
    trace(`${T} onDvrStateChanged`, {
      dvrEnabled,
    })
    if (dvrEnabled) {
      this.render()
    }
  }

  private allRateElements(): ZeptoResult {
    return this.$('ul.gear-sub-menu li')
  }

  private rateElement(rate = '1'): ZeptoResult {
    return (
      this.$(`ul.gear-sub-menu a[data-rate="${rate}"]`) as ZeptoResult
    ).parent()
  }

  private onPlaybackRateChange(playbackRate: number) {
    const selectedRate = parseInt(this.selectedRate, 10)
    // TODO check it doesn't interfere with the DASH.js or HLS.js playback live catchup
    if (Math.abs(playbackRate - selectedRate) > 0.1) {
      trace(`${T} onPlaybackRateChange setting target rate`, {
        playbackRate,
        selectedRate,
      })
      this.core.activePlayback?.setPlaybackRate(selectedRate)
    }
  }

  private shouldRender() {
    if (!this.core.activePlayback) {
      return false
    }

    if (
      this.core.activePlayback.getPlaybackType() === Playback.LIVE &&
      !this.core.activePlayback.dvrEnabled
    ) {
      return false
    }

    return 'setPlaybackRate' in this.core.activePlayback
  }

  /**
   * @internal
   */
  override render() {
    trace(`${T} render`, {
      rendered: this.rendered,
      shouldRender: this.shouldRender(),
    })

    if (!this.shouldRender()) {
      return this
    }

    if (this.rendered) {
      return this
    }

    const button = PlaybackRate.buttonTemplate({
      title: this.getTitle(),
      speedIcon,
      arrowRightIcon,
      i18n: this.core.i18n,
    })

    this.$el.html(button)

    ;(this.core.getPlugin('bottom_gear') as BottomGear)
      ?.getElement('rate')
      ?.html(this.el)

    this.rendered = true

    return this
  }

  private onStartAd() {
    this.prevSelectedRate = this.selectedRate
    this.resetPlaybackRate()
    this.listenToOnce(
      this.core.activePlayback,
      Events.PLAYBACK_PLAY,
      this.onFinishAd,
    )
  }

  private onFinishAd() {
    if (this.prevSelectedRate) {
      this.setSelectedRate(this.prevSelectedRate)
    }
  }

  private onPlay() {
    if (
      this.core.getPlaybackType() === Playback.LIVE &&
      !this.core.activePlayback.dvrEnabled
    ) {
      this.resetPlaybackRate()
    } else {
      this.setSelectedRate(this.selectedRate)
    }
  }

  private resetPlaybackRate() {
    this.setSelectedRate(DEFAULT_PLAYBACK_RATE)
  }

  private onStop() {}

  private onRateSelect(event: MouseEvent) {
    event.stopPropagation()
    const rate = (event.currentTarget as HTMLElement).dataset.rate
    if (rate) {
      this.setSelectedRate(rate)
      this.highlightCurrentRate()
    }

    return false
  }

  private onShowMenu() {
    this.$el.html(
      PlaybackRate.listTemplate({
        playbackRates: this.playbackRates,
        arrowLeftIcon,
        checkIcon,
        i18n: this.core.i18n,
      }),
    )
    ;(this.core.getPlugin('bottom_gear') as BottomGear)?.setContent(this.el)
    this.highlightCurrentRate()
  }

  private goBack() {
    setTimeout(() => {
      this.core.getPlugin('bottom_gear').refresh()
    }, 0)
  }

  private setSelectedRate(rate: string) {
    // Set <video playbackRate="..."
    this.core.activePlayback?.setPlaybackRate(rate)
    this.selectedRate = rate
  }

  private getTitle() {
    return (
      this.playbackRates.find((r) => r.value === this.selectedRate)?.label ||
      this.selectedRate
    )
  }

  private highlightCurrentRate() {
    this.allRateElements().removeClass('current')
    this.allRateElements().find('a').removeClass('gcore-skin-active')

    const currentLevelElement = this.rateElement(this.selectedRate)

    currentLevelElement.addClass('current')
    currentLevelElement.find('a').addClass('gcore-skin-active')
  }
}
