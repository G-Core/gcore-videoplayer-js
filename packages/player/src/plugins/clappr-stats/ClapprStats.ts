import { Container, ContainerPlugin, Events as CoreEvents } from '@clappr/core'

import type {
  QualityLevel,
  TimePosition,
  TimeProgress,
} from '../../playback.types.js'

import { CLAPPR_VERSION } from '../../build.js'
import { TimerId } from '../../utils/types.js'
import type { ClapprStatsMetrics } from './types.js'
import {
  ClapprStatsEvents,
  ClapprStatsChronograph,
  ClapprStatsCounter,
} from './types.js'
export * from './types.js'
import { newMetrics } from './utils.js'
import { isFullscreen } from '../utils/fullscreen.js'

// const T = 'plugins.clappr_stats'

/**
 * Config options for the {@link ClapprStats} plugin
 * @public
 */
export interface ClapprStatsSettings {
  /**
   * The interval in milliseconds of periodic measurements.
   * The plugin will emit a {@link ClapprStatsEvents.REPORT} event with the collected metrics at the specified interval.
   */
  runEach?: number
}

/**
 * `PLUGIN` that measures data about playback, which can be useful for analyzing performance and UX.
 * @public
 * @remarks
 * This plugin does not render anything and is supposed to be extended or used together with other plugins that actually render something.
 *
 * @see {@link NerdStats} - a plugin that visualises the playback metrics
 *
 * Configuration options - {@link ClapprStatsSettings}
 *
 * Events - {@link ClapprStatsEvents}
 */
export class ClapprStats extends ContainerPlugin {
  private timerId: TimerId | null = null

  private lastDecodedFramesCount = 0

  private metrics: ClapprStatsMetrics = newMetrics()

  private timers: Record<ClapprStatsChronograph, number> = {
    [ClapprStatsChronograph.Startup]: 0,
    [ClapprStatsChronograph.Watch]: 0,
    [ClapprStatsChronograph.Pause]: 0,
    [ClapprStatsChronograph.Buffering]: 0,
    [ClapprStatsChronograph.Session]: 0,
  }

  private runEach: number

  /**
   * @internal
   */
  get name() {
    return 'clappr_stats'
  }

  /**
   * @internal
   */
  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  private get playbackName() {
    return String(this.container.playback.name || '')
  }

  private get playbackType() {
    return this.container.getPlaybackType()
  }

  private now() {
    const hasPerformanceSupport =
      window.performance && typeof window.performance.now === 'function'

    return hasPerformanceSupport
      ? window.performance.now()
      : new Date().getTime()
  }

  private inc(counter: ClapprStatsCounter) {
    this.metrics.counters[counter] += 1
  }

  private start(timer: ClapprStatsChronograph) {
    this.timers[timer] = this.now()
  }

  private stop(timer: ClapprStatsChronograph) {
    this.metrics.chrono[timer] += this.now() - this.timers[timer]
  }

  constructor(container: Container) {
    super(container)
    this.runEach = container.options.clapprStats?.runEach ?? 5000
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.container, CoreEvents.CONTAINER_BITRATE, this.onBitrate)
    this.listenTo(this.container, CoreEvents.CONTAINER_STOP, this.stopReporting)
    this.listenTo(
      this.container,
      CoreEvents.CONTAINER_ENDED,
      this.stopReporting,
    )
    this.listenToOnce(
      this.container.playback,
      CoreEvents.PLAYBACK_PLAY_INTENT,
      this.startTimers,
    )
    this.listenToOnce(
      this.container,
      CoreEvents.CONTAINER_PLAY,
      this.onFirstPlaying,
    )
    this.listenTo(this.container, CoreEvents.CONTAINER_PLAY, this.onPlay)
    this.listenTo(this.container, CoreEvents.CONTAINER_PAUSE, this.onPause)
    this.listenToOnce(
      this.container,
      CoreEvents.CONTAINER_STATE_BUFFERING,
      this.onBuffering,
    )
    this.listenTo(this.container, CoreEvents.CONTAINER_SEEK, this.onSeek)
    this.listenTo(this.container, CoreEvents.CONTAINER_ERROR, () =>
      this.inc(ClapprStatsCounter.Error),
    )
    this.listenTo(this.container, CoreEvents.CONTAINER_FULLSCREEN, () => {
      if (isFullscreen(this.container.el)) {
        this.inc(ClapprStatsCounter.Fullscreen)
      }
    })
    this.listenTo(
      this.container,
      CoreEvents.CONTAINER_PLAYBACKDVRSTATECHANGED,
      (dvrInUse: boolean) => {
        dvrInUse && this.inc(ClapprStatsCounter.DvrUsage)
      },
    )
    this.listenTo(
      this.container.playback,
      CoreEvents.PLAYBACK_PROGRESS,
      this.onProgress,
    )
    this.listenTo(
      this.container.playback,
      CoreEvents.PLAYBACK_TIMEUPDATE,
      this.onTimeUpdate,
    )
  }

  /**
   * @internal
   */
  override destroy() {
    this.stopReporting()
    super.destroy()
  }

  /**
   * Returns the collected metrics.
   * @returns {@link ClapprStatsMetrics | Measurements} collected so far
   */
  exportMetrics() {
    return structuredClone(this.metrics)
  }

  clearMetrics() {
    this.metrics = newMetrics()
  }

  private onBitrate(newBitrate: QualityLevel) {
    const bitrate = newBitrate.bitrate
    const now = this.now()

    if (this.metrics.extra.bitratesHistory.length > 0) {
      const last =
        this.metrics.extra.bitratesHistory[
          this.metrics.extra.bitratesHistory.length - 1
        ]
      last.end = now
      last.time = now - last.start
    }

    this.metrics.extra.bitratesHistory.push({ start: this.now(), bitrate })

    this.inc(ClapprStatsCounter.ChangeLevel)
  }

  private stopReporting() {
    this.buildReport()

    if (this.timerId !== null) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }

  private startTimers() {
    this.timerId = setInterval(this.buildReport.bind(this), this.runEach)
    this.start(ClapprStatsChronograph.Session)
    this.start(ClapprStatsChronograph.Startup)
  }

  private onFirstPlaying() {
    this.listenTo(
      this.container,
      CoreEvents.CONTAINER_TIMEUPDATE,
      this.onContainerUpdateWhilePlaying,
    )

    this.start(ClapprStatsChronograph.Watch)
    this.stop(ClapprStatsChronograph.Startup)
  }

  private playAfterPause() {
    this.listenTo(
      this.container,
      CoreEvents.CONTAINER_TIMEUPDATE,
      this.onContainerUpdateWhilePlaying,
    )
    this.stop(ClapprStatsChronograph.Pause)
    this.start(ClapprStatsChronograph.Watch)
  }

  private onPlay() {
    this.inc(ClapprStatsCounter.Play)
  }

  private onPause() {
    this.stop(ClapprStatsChronograph.Watch)
    this.start(ClapprStatsChronograph.Pause)
    this.inc(ClapprStatsCounter.Pause)
    this.listenToOnce(
      this.container,
      CoreEvents.CONTAINER_PLAY,
      this.playAfterPause,
    )
    this.stopListening(
      this.container,
      CoreEvents.CONTAINER_TIMEUPDATE,
      this.onContainerUpdateWhilePlaying,
    )
  }

  private onSeek(e: number) {
    const ms = e * 1000
    this.inc(ClapprStatsCounter.Seek)
    this.metrics.extra.watchHistory.push([ms, ms])
  }

  private onTimeUpdate(e: TimePosition) {
    const current = e.current * 1000,
      total = e.total * 1000,
      l = this.metrics.extra.watchHistory.length

    this.metrics.extra.duration = total
    this.metrics.extra.currentTime = current
    // TODO what if it's a live stream?
    this.metrics.extra.watchedPercentage = (current / total) * 100

    if (l === 0) {
      this.metrics.extra.watchHistory.push([current, current])
    } else {
      this.metrics.extra.watchHistory[l - 1][1] = current
    }

    if (this.metrics.extra.bitratesHistory.length > 0) {
      const lastBitrate =
        this.metrics.extra.bitratesHistory[
          this.metrics.extra.bitratesHistory.length - 1
        ]

      if (!lastBitrate.end) {
        lastBitrate.time = this.now() - lastBitrate.start
      }
    }

    this.onCompletion()
  }

  private onContainerUpdateWhilePlaying() {
    if (this.container.playback.isPlaying()) {
      this.stop(ClapprStatsChronograph.Watch)
      this.start(ClapprStatsChronograph.Watch)
    }
  }

  private onBuffering() {
    this.inc(ClapprStatsCounter.Buffering)
    this.start(ClapprStatsChronograph.Buffering)
    this.listenToOnce(
      this.container,
      CoreEvents.CONTAINER_STATE_BUFFERFULL,
      this.onBufferfull,
    )
  }

  private onBufferfull() {
    this.stop(ClapprStatsChronograph.Buffering)
    this.listenToOnce(
      this.container,
      CoreEvents.CONTAINER_STATE_BUFFERING,
      this.onBuffering,
    )
  }

  private onProgress(progress: TimeProgress) {
    this.metrics.extra.buffersize = progress.current * 1000
  }

  private onCompletion() {
    // Decide if this is needed
    // const currentPercentage = this.metrics.extra.watchedPercentage;
    // this.trigger(ClapprStatsEvents.PERCENTAGE, currentPercentage);
  }

  private buildReport() {
    this.stop(ClapprStatsChronograph.Session)
    this.start(ClapprStatsChronograph.Session)

    this.metrics.extra.playbackName = this.playbackName
    this.metrics.extra.playbackType = this.playbackType

    this.calcBitrates()
    this.calcBufferingPercentage()
    // TODO calc FPS properly, e.g., on TIMEUPDATE event
    this.fetchFPS()
    this.trigger(ClapprStatsEvents.REPORT, structuredClone(this.metrics))
  }

  private fetchFPS() {
    // TODO check if the playback and media sources support video, then use the common method
    // flashls ??? - hls.droppedFramesl hls.stream.bufferLength (seconds)
    // hls ??? (use the same?)
    const fetchFPS = {
      html5_video: this.html5FetchFPS,
      hls: this.html5FetchFPS,
      dash: this.html5FetchFPS,
    }

    if (this.playbackName in fetchFPS) {
      fetchFPS[this.playbackName as keyof typeof fetchFPS].call(this)
    }
  }

  // TODO sort out
  private calcBitrates() {
    const { bitratesHistory } = this.metrics.extra

    if (bitratesHistory.length === 0) {
      return
    }

    let totalTime = 0
    let weightedTotal = 0

    for (const { bitrate, time = 0 } of bitratesHistory) {
      totalTime += time
      weightedTotal += bitrate * time
    }
    this.metrics.extra.bitrateWeightedMean = weightedTotal / totalTime

    this.metrics.extra.bitrateMostUsed = bitratesHistory.reduce(
      (mostUsed, current) =>
        (current.time || 0) > (mostUsed.time || 0) ? current : mostUsed,
      { time: 0, bitrate: 0, start: 0, end: 0 },
    ).bitrate
  }

  private calcBufferingPercentage() {
    if (this.metrics.extra.duration > 0) {
      this.metrics.extra.bufferingPercentage =
        (this.metrics.chrono.buffering / this.metrics.extra.duration) * 100
    }
  }

  private html5FetchFPS() {
    const videoTag = this.container.playback.el

    const getFirstValidValue = (...args: any[]) =>
      args.find((val) => val !== undefined)

    const decodedFrames = getFirstValidValue(
      videoTag.webkitDecodedFrameCount,
      videoTag.mozDecodedFrames,
      0,
    )
    const droppedFrames = getFirstValidValue(
      videoTag.webkitDroppedFrameCount,
      videoTag.mozParsedFrames && videoTag.mozDecodedFrames
        ? videoTag.mozParsedFrames - videoTag.mozDecodedFrames
        : 0,
      0,
    )
    const delta = decodedFrames - (this.lastDecodedFramesCount || 0)

    this.metrics.counters.decodedFrames = decodedFrames
    this.metrics.counters.droppedFrames = droppedFrames
    this.metrics.counters.fps = delta / (this.runEach / 1000) // TODO use time delta instead of runEach

    this.lastDecodedFramesCount = decodedFrames
  }
}
