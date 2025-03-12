import { Events, UICorePlugin, Playback, template, Core, $ } from '@clappr/core'
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
import { BottomGear, GearEvents } from '../bottom-gear/BottomGear.js'
import { PlaybackEvents } from '../../playback/types.js'
import { MediaControl } from '../media-control/MediaControl.js'

/**
 * @beta
 */
export type PlaybackRateOption = {
  value: number
  label: string
}

/**
 * @beta
 */
export type PlaybackRateSettings = {
  options?: PlaybackRateOption[]
  defaultValue?: number
}

const DEFAULT_PLAYBACK_RATES = [
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1.0, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 1.75, label: '1.75x' },
  { value: 2.0, label: '2x' },
]

const DEFAULT_PLAYBACK_RATE = 1

const T = 'plugins.playback_rate'

/**
 * `PLUGIN` that allows changing the playback speed of the video.
 * @beta
 *
 * @remarks
 * Depends on:
 *
 * - {@link MediaControl}
 *
 * - {@link BottomGear}
 *
 * It renders an option in the gear menu, which opens a dropdown with the options to change the playback rate.
 * Note that the playback rate change is supported only for VOD or DVR-enabled live streams.
 *
 * Plugin settings - {@link PlaybackRateSettings}
 *
 * @example
 * ```ts
 * import { Player, PlaybackRateSettings } from '@gcorevideo/player'
 * Player.registerPlugin(PlaybackRate)
 * const player = new Player({
 *   playbackRate: {
 *     options: [
 *       { value: 0.5, label: '0.5x' },
 *       { value: 1, label: '1x' },
 *     ],
 *     defaultValue: 1,
 *   } as PlaybackRateSettings,
 * })
 * ```
 */
export class PlaybackRate extends UICorePlugin {
  private playbackRates: PlaybackRateOption[] = DEFAULT_PLAYBACK_RATES

  // Saved when an ad starts to restore after it finishes
  // private prevSelectedRate: string | undefined

  private selectedRate = DEFAULT_PLAYBACK_RATE

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
      'click [data-rate]': 'onSelect',
      'click #playback-rate-back-button': 'goBack',
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
      Events.MEDIACONTROL_RENDERED,
      this.onMediaControlRendered,
    )
    this.listenTo(gear, GearEvents.RENDERED, this.onGearRendered)
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
      Events.CONTAINER_LOADEDMETADATA,
      this.onMetaDataLoaded,
    )
  }

  private onMediaControlRendered() {
    trace(`${T} onMediaControlRendered`)
    this.render()
  }

  private onGearRendered() {
    trace(`${T} onGearRendered`)
    this.addGearItem()
  }

  private addGearItem() {
    trace(`${T} addGearItem`)
    this.core
      .getPlugin('bottom_gear')
      ?.addItem('rate', this.$el)
      .html(
        $(
          PlaybackRate.buttonTemplate({
            title: this.getTitle(),
            speedIcon,
            arrowRightIcon,
            i18n: this.core.i18n,
          }),
        ),
      )
  }

  private onMetaDataLoaded() {
    trace(`${T} onMetaDataLoaded`)
    this.render()
  }

  private allRateElements(): ZeptoResult {
    return this.$el.find('#playback-rate-menu li')
  }

  private rateElement(rate: number): ZeptoResult {
    return (
      this.$el.find(`#playback-rate-menu a[data-rate="${rate}"]`) as ZeptoResult
    ).parent()
  }

  private onPlaybackRateChange(playbackRate: number) {
    // TODO check it doesn't interfere with the DASH.js or HLS.js playback live catchup
    if (Math.abs(playbackRate - this.selectedRate) > 0.1) {
      this.core.activePlayback?.setPlaybackRate(this.selectedRate)
    } else {
      trace(
        `${T} onPlaybackRateChange not steering to the selected rate, it is seemingly a catchup algorithm working`,
        {
          playbackRate,
          selectedRate: this.selectedRate,
        },
      )
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
      shouldRender: this.shouldRender(),
    })

    if (!this.shouldRender()) {
      return this
    }

    this.$el.html(
      PlaybackRate.listTemplate({
        arrowLeftIcon,
        checkIcon,
        current: this.selectedRate,
        i18n: this.core.i18n,
        playbackRates: this.playbackRates,
      }),
    )

    this.addGearItem()

    return this
  }

  // private onStartAd() {
  //   this.prevSelectedRate = this.selectedRate
  //   this.resetPlaybackRate()
  //   this.listenToOnce(
  //     this.core.activePlayback,
  //     Events.PLAYBACK_PLAY,
  //     this.onFinishAd,
  //   )
  // }

  // private onFinishAd() {
  //   if (this.prevSelectedRate) {
  //     this.setSelectedRate(this.prevSelectedRate)
  //   }
  // }

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

  private onSelect(event: MouseEvent) {
    event.stopPropagation()
    const rate = parseFloat(
      (event.currentTarget as HTMLElement).dataset.rate || '',
    )
    if (rate) {
      this.setSelectedRate(rate)
      this.highlightCurrentRate()
      this.updateGearOptionLabel()
    }

    return false
  }

  private goBack() {
    setTimeout(() => {
      this.core.getPlugin('bottom_gear').refresh()
    }, 0)
  }

  private setSelectedRate(rate: number) {
    this.core.activePlayback?.setPlaybackRate(rate)
    this.selectedRate = rate
  }

  private getTitle() {
    return (
      this.playbackRates.find((r) => r.value === this.selectedRate)?.label ||
      `x${this.selectedRate}`
    )
  }

  private highlightCurrentRate() {
    this.allRateElements().removeClass('current')
    this.allRateElements().find('a').removeClass('gcore-skin-active')

    this.rateElement(this.selectedRate)
      .addClass('current')
      .find('a')
      .addClass('gcore-skin-active')
  }

  private updateGearOptionLabel() {
    trace(`${T} updateGearOptionLabel`)
    this.addGearItem()
  }
}
