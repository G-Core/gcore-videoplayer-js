import {
  UICorePlugin,
  Events,
  template,
  Core,
  Container,
  Playback,
} from '@clappr/core'
import { reportError/* , trace */ } from '@gcorevideo/utils'
import Mousetrap from 'mousetrap'
import assert from 'assert'

import { CLAPPR_VERSION } from '../../build.js'
import {
  ClapprStatsEvents,
  ClapprStatsMetrics as PerfMetrics,
} from '../clappr-stats/types.js'
import { newMetrics as newBaseMetrics } from '../clappr-stats/utils.js'
import Formatter from './formatter.js'
import {
  clearSpeedTestResults,
  configureSpeedTest,
  drawSpeedTestResults,
  initSpeedTest,
  startSpeedtest,
  stopSpeedtest,
} from './speedtest/index.js'
import { SpeedtestMetrics } from './speedtest/types.js'
import { PlaybackType } from '../../types.js'

import '../../../assets/clappr-nerd-stats/clappr-nerd-stats.scss'
import pluginHtml from '../../../assets/clappr-nerd-stats/clappr-nerd-stats.ejs'
import buttonHtml from '../../../assets/clappr-nerd-stats/button.ejs'
import statsIcon from '../../../assets/icons/new/stats.svg'
import { BottomGear, GearEvents } from '../bottom-gear/BottomGear.js'
import { drawSummary, getPingQuality } from './utils.js'
import { getDownloadQuality } from './utils.js'

const PLAYBACK_NAMES: Record<string, string> = {
  dash: 'DASH.js',
  hls: 'HLS.js',
  html5_video: 'Native',
}

type IconPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

type Metrics = PerfMetrics & {
  general: {
    displayResolution?: string
    resolution: {
      width: number
      height: number
    }
    volume: number
  }
  custom: SpeedtestMetrics & {
    vodQuality?: string
    liveQuality?: string
  }
}

// const T = 'plugins.nerd_stats'

/**
 * `PLUGIN` that displays useful statistics regarding the playback as well as the network quality estimation.
 * @public
 *
 * @remarks
 * Depends on:
 *
 * - {@link BottomGear} - where the button is attached
 *
 * - {@link ClapprStats} - to get the metrics from
 *
 * The plugin is rendered as an item in the gear menu.
 *
 * When clicked, it shows an overlay window with the information about the network speed, latency, etc,
 * and recommended quality level.
 */
export class NerdStats extends UICorePlugin {
  private container: Container | null = null

  private speedtestMetrics: SpeedtestMetrics = {
    connectionSpeed: 0,
    ping: 0,
    jitter: 0,
  }

  private metrics: Metrics = newMetrics()

  private open = false

  private shortcut: string[]

  private iconPosition: IconPosition

  private static readonly buttonTemplate = template(buttonHtml)

  /**
   * @internal
   */
  get name() {
    return 'nerd_stats'
  }

  /**
   * @internal
   */
  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  private static readonly template = template(pluginHtml)

  /**
   * @internal
   */
  override get attributes() {
    return {
      class: 'clappr-nerd-stats',
    }
  }

  /**
   * @internal
   */
  override get events() {
    return {
      click: 'clicked',
      'click #nerd-stats-close': 'hide',
      'click #nerd-stats-refresh': 'refreshSpeedTest',
    }
  }

  private clicked(e: MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
  }

  private get statsBoxElem() {
    return this.$el.find('#nerd-stats-box')
  }

  private get statsBoxWidthThreshold() {
    return 720
  }

  private get playerWidth() {
    return this.core.$el.width()
  }

  private get playerHeight() {
    return this.core.$el.height()
  }

  constructor(core: Core) {
    super(core)
    this.shortcut = core.options.clapprNerdStats?.shortcut ?? [
      'command+shift+s',
      'ctrl+shift+s',
    ]
    this.iconPosition =
      core.options.clapprNerdStats?.iconPosition ?? 'bottom-right'
    this.speedtestMetrics = {
      connectionSpeed: 0,
      ping: 0,
      jitter: 0,
    }
    configureSpeedTest(core.options.clapprNerdStats?.speedTestServers ?? [])
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenToOnce(this.core, Events.CORE_READY, this.onCoreReady)
    this.listenTo(this.core, Events.CORE_RESIZE, this.onPlayerResize)
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.onActiveContainerChanged,
    )
  }

  private onCoreReady() {
    const bottomGear = this.core.getPlugin('bottom_gear') as BottomGear
    assert(bottomGear, 'bottom_gear plugin is required')
    this.listenTo(bottomGear, GearEvents.RENDERED, this.attach)

    Mousetrap.bind(this.shortcut, this.toggle)
    this.updateResolution()
  }

  private onActiveContainerChanged() {
    this.container = this.core.activeContainer
    const clapprStats = this.container?.getPlugin('clappr_stats')
    assert(
      clapprStats,
      'clappr-stats not available. Please, include it as a plugin of your Clappr instance.\n' +
        'For more info, visit: https://github.com/clappr/clappr-stats.',
    )
    this.listenTo(clapprStats, ClapprStatsEvents.REPORT, this.updateMetrics)
    this.listenTo(this.core.activeContainer, Events.CONTAINER_VOLUME, () => {
      this.metrics.general.volume = this.container?.volume ?? 0
      this.$el
        .find('#nerd-stats-volume')
        .text(Formatter.formatVolume(this.metrics.general.volume))
    })
    this.listenTo(
      this.core.activePlayback,
      Events.PLAYBACK_LOADEDMETADATA,
      () => {
        this.$el
          .find('#nerd-stats-playback-type')
          .text(
            this.formatPlaybackName(this.core.activePlayback.getPlaybackType()),
          )
      },
    )
    this.updateMetrics(clapprStats.exportMetrics())
    this.$el
      .find('#nerd-stats-playback-name')
      .text(PLAYBACK_NAMES[this.core.activePlayback.name] ?? '-')
    this.core.activeContainer.$el.append(this.$el)
  }

  /**
   * @internal
   */
  override destroy() {
    Mousetrap.unbind(this.shortcut)
    return super.destroy()
  }

  private toggle = () => {
    if (this.open) {
      this.hide()
    } else {
      this.show()
    }
  }

  private show() {
    this.$el.show()
    this.statsBoxElem.scrollTop(this.statsBoxElem.scrollTop())
    this.open = true

    initSpeedTest(this.speedtestMetrics)
      .then(() => {
        startSpeedtest()
      })
      .catch((e) => {
        reportError(e)
        this.disable()
      })
  }

  private hide() {
    this.$el.hide()
    this.open = false
    stopSpeedtest()
  }

  private onPlayerResize() {
    this.setStatsBoxSize()
    this.updateResolution()
  }

  private updateResolution() {
    this.metrics.general.resolution = {
      width: this.playerWidth,
      height: this.playerHeight,
    }
    this.$el
      .find('#nerd-stats-resolution-width')
      .text(this.metrics.general.resolution.width)
    this.$el
      .find('#nerd-stats-resolution-height')
      .text(this.metrics.general.resolution.height)
  }

  private estimateQuality() {
    const videoQualityNames = [
      'SD (480p)',
      'HD (720p)',
      'Full HD (1080p)',
      '2K (1440p)',
      '4K (2160p)',
    ]
    const { connectionSpeed, ping } = this.speedtestMetrics

    if (!connectionSpeed || !ping) {
      const calculatingText = this.core.i18n.t('stats.calculating')
      this.metrics.custom.vodQuality = calculatingText
      this.metrics.custom.liveQuality = calculatingText
      return
    }

    const downloadQuality = getDownloadQuality(connectionSpeed)
    const pingQuality = getPingQuality(ping)
    const liveQuality = Math.min(downloadQuality, pingQuality)

    const prefix = 'Optimal for '

    this.metrics.custom.vodQuality =
      prefix + videoQualityNames[downloadQuality - 1]
    this.metrics.custom.liveQuality =
      prefix + videoQualityNames[liveQuality - 1]
  }

  private updateMetrics(metrics: PerfMetrics) {
    Object.assign(this.metrics, metrics)
    this.metrics.custom = {
      ...this.speedtestMetrics,
    }

    this.updateCustomMetrics()

    this.$el
      .find('#nerd-stats-current-time')
      .text(Formatter.formatTime(this.metrics.extra.currentTime))
    this.$el
      .find('#nerd-stats-video-duration')
      .text(Formatter.formatTime(this.metrics.extra.duration))
    this.$el
      .find('#nerd-stats-buffer-size')
      .text(Formatter.formatTime(this.metrics.extra.buffersize))

    this.$el
      .find('#nerd-stats-bitrate-weighted-mean')
      .text(Formatter.formatBitrate(this.metrics.extra.bitrateWeightedMean))
    this.$el
      .find('#nerd-stats-bitrate-most-used')
      .text(Formatter.formatBitrate(this.metrics.extra.bitrateMostUsed))
    this.$el
      .find('#nerd-stats-watched-percentage')
      .text(Formatter.formatPercentage(this.metrics.extra.watchedPercentage))
    this.$el
      .find('#nerd-stats-buffering-percentage')
      .text(Formatter.formatPercentage(this.metrics.extra.bufferingPercentage))

    this.$el
      .find('#nerd-stats-startup-time')
      .text(Formatter.formatTime(this.metrics.chrono.startup))
    this.$el
      .find('#nerd-stats-watch-time')
      .text(Formatter.formatTime(this.metrics.chrono.watch))
    this.$el
      .find('#nerd-stats-pause-time')
      .text(Formatter.formatTime(this.metrics.chrono.pause))
    this.$el
      .find('#nerd-stats-buffering-time')
      .text(Formatter.formatTime(this.metrics.chrono.buffering))
    this.$el
      .find('#nerd-stats-session-time')
      .text(Formatter.formatTime(this.metrics.chrono.session))

    this.$el.find('#nerd-stats-plays').text(this.metrics.counters.play)
    this.$el.find('#nerd-stats-pauses').text(this.metrics.counters.pause)
    this.$el.find('#nerd-stats-errors').text(this.metrics.counters.error)
    this.$el
      .find('#nerd-stats-bufferings')
      .text(this.metrics.counters.buffering)
    this.$el
      .find('#nerd-stats-decoded-frames')
      .text(this.metrics.counters.decodedFrames)
    this.$el
      .find('#nerd-stats-dropped-frames')
      .text(this.metrics.counters.droppedFrames)

    this.$el
      .find('#nerd-stats-bitrate-changes')
      .text(this.metrics.counters.changeLevel)
    this.$el.find('#nerd-stats-seeks').text(this.metrics.counters.seek)
    this.$el
      .find('#nerd-stats-fullscreen')
      .text(this.metrics.counters.fullscreen)
    this.$el.find('#nerd-stats-dvr-usage').text(this.metrics.counters.dvrUsage)

    this.$el
      .find('#nerd-stats-fps')
      .text(Formatter.formatFps(this.metrics.counters.fps))

    this.setStatsBoxSize()
    drawSpeedTestResults()
    this.updateEstimatedQuality()

    if (!this.open) {
      this.hide()
    }
  }

  private updateCustomMetrics() {
    this.$el
      .find('#nerd-stats-dl-text')
      .text(this.metrics.custom.connectionSpeed.toFixed(2))
    this.$el
      .find('#nerd-stats-ping-text')
      .text(this.metrics.custom.ping.toFixed(2))
    this.$el
      .find('#nerd-stats-jitter-text')
      .text(this.metrics.custom.jitter.toFixed(2))
  }

  private updateEstimatedQuality() {
    this.estimateQuality()
    this.$el
      .find('#nerd-stats-quality-vod-text')
      .html(this.metrics.custom.vodQuality)
    this.$el
      .find('#nerd-stats-quality-live-text')
      .html(this.metrics.custom.liveQuality)

    drawSummary(
      this.speedtestMetrics,
      this.$el.find('#nerd-stats-quality-vod'),
      this.$el.find('#nerd-stats-quality-live'),
    )
  }

  private setStatsBoxSize() {
    if (this.playerWidth >= this.statsBoxWidthThreshold) {
      this.statsBoxElem.addClass('wide')
      this.statsBoxElem.removeClass('narrow')
    } else {
      this.statsBoxElem.removeClass('wide')
      this.statsBoxElem.addClass('narrow')
    }
  }

  /**
   * @internal
   */
  override render() {
    this.$el
      .html(
        NerdStats.template({
          metrics: Formatter.format(this.metrics ?? newMetrics()),
          iconPosition: this.iconPosition,
          i18n: this.core.i18n,
        }),
      )
      .hide()

    return this
  }

  private attach() {
    const gear = this.core.getPlugin('bottom_gear') as BottomGear
    gear
      .addItem('nerd_stats')
      .html(
        NerdStats.buttonTemplate({
          icon: statsIcon,
          i18n: this.core.i18n,
        }),
      )
      .on('click', (e: MouseEvent) => {
        e.stopPropagation()
        this.toggle()
      })
  }

  private clearSpeedtestMetrics() {
    const clapprStats = this.container?.getPlugin('clappr_stats')

    this.speedtestMetrics.connectionSpeed = 0
    this.speedtestMetrics.ping = 0
    this.speedtestMetrics.jitter = 0

    if (clapprStats) {
      clapprStats.clearMetrics()
      this.updateMetrics(clapprStats.exportMetrics())
    }
  }

  private refreshSpeedTest() {
    stopSpeedtest()
    setTimeout(() => {
      this.clearSpeedtestMetrics()
      clearSpeedTestResults()
      drawSpeedTestResults()
    }, 200)
    setTimeout(() => {
      startSpeedtest()
    }, 800)
  }

  private formatPlaybackName(playbackType: PlaybackType): string {
    switch (playbackType) {
      case Playback.VOD:
        return this.core.i18n.t('vod')
      case Playback.LIVE:
        return this.core.i18n.t('live')
      default:
        return '-'
    }
  }
}

function newMetrics(): Metrics {
  return {
    ...newBaseMetrics(),
    general: {
      displayResolution: '',
      resolution: {
        width: 0,
        height: 0,
      },
      volume: 0,
    },
    custom: {
      connectionSpeed: 0,
      ping: 0,
      jitter: 0,
    },
  }
}
