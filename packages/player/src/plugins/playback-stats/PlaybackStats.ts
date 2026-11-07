// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// https://github.com/clappr/clappr/blob/efa8bd4a6d21075f48ef731e81971113f04f8b18/packages/clappr-plugins/src/plugins/stats/stats.js#L87

import { ContainerPlugin, Events, $, Container } from '@clappr/core'

import { TimerId } from '../../utils/types.js'

import { CLAPPR_VERSION } from '../../build.js'

const VERSION = '2.17.0'

/**
 * Options for the {@link PlaybackStats} plugin.
 * @beta
 * @remarks
 * The options are passed at the top level of the {@link PlayerConfig | player configuration},
 * not nested under the plugin name.
 *
 * - `reportInterval` - interval in milliseconds at which the stats report is sent
 * while the playback is playing. Default is 5000.
 *
 * @example
 * ```ts
 * Player.registerPlugin(PlaybackStats)
 * const player = new Player({
 *   sources: [...],
 *   reportInterval: 10000,
 * })
 * ```
 */
export type PlaybackStatsPluginSettings = {
  /**
   * Interval in milliseconds at which the stats report is sent while the playback is playing.
   * Default is 5000.
   */
  reportInterval?: number
}

/**
 * Extra metrics that can be added to the stats report.
 * @beta
 */
export type ExtraPlaybackMetrics = Record<string, any>

/**
 * Stats report containing playback metrics.
 * @beta
 * @remarks
 * - `rebufferingTime` - total accumulated rebuffering time in milliseconds
 *
 * - `rebuffers` - total number of rebuffering events, excluding the startup buffering and buffering while paused
 *
 * - `startupTime` - time from the last play request to the first frame in milliseconds, 0 until the playback starts
 *
 * - `watchingTime` - total time the playback was playing, excluding rebuffering and pauses, in milliseconds
 */
export type PlaybackStatsReport = {
  rebufferingTime: number
  rebuffers: number
  startupTime: number
  watchingTime: number
} & ExtraPlaybackMetrics

/**
 * Collects playback metrics and reports them periodically.
 * @beta
 * @remarks
 * While the playback is playing, a {@link PlaybackStatsReport} is emitted every
 * `reportInterval` milliseconds with the container's `container:stats:report` event.
 * A final report is emitted on pause, stop, end of the playback and when the container is destroyed.
 * The current metrics can be read at any time with {@link PlaybackStats.getStats}.
 *
 * Configuration options - {@link PlaybackStatsPluginSettings}
 */
export class PlaybackStats extends ContainerPlugin {
  get name() {
    return 'playback_stats'
  }
  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  static get version() {
    return VERSION
  }

  private reportInterval: number

  private firstPlay = true
  private startupTime = 0 // ms

  private rebufferingTime = 0 // ms
  private rebuffers = 0

  /**
   * Accumulated duration of the completed watching segments, ms.
   * Watching time only runs while the playback is playing and not buffering.
   */
  private watchingTime = 0
  /**
   * Start of the current watching segment, or 0 when not watching
   */
  private watchingSince: DOMHighResTimeStamp = 0
  private playing = false
  private buffering = false
  /**
   * Set between a pause and the next play. While paused, stats are neither
   * collected nor reported.
   */
  private paused = false

  private startupTimeInit: DOMHighResTimeStamp = 0
  private rebufferingTimeInit: DOMHighResTimeStamp = 0
  private intervalId: TimerId | null = null

  private externalMetrics: ExtraPlaybackMetrics = {}

  constructor(container: Container) {
    super(container)
    this.reportInterval =
      (this.options as PlaybackStatsPluginSettings).reportInterval || 5000
  }

  /**
   * @internal
   */
  override destroy() {
    this.stopReporting()
    return super.destroy()
  }

  override bindEvents() {
    this.listenTo(
      this.container.playback,
      Events.PLAYBACK_PLAY_INTENT,
      this.onPlayIntent,
    )
    this.listenTo(this.container.playback, Events.PLAYBACK_PLAY, this.onPlay)
    this.listenTo(this.container.playback, Events.PLAYBACK_PAUSE, this.onPause)
    this.listenTo(this.container, Events.CONTAINER_STOP, this.onStop)
    this.listenTo(this.container, Events.CONTAINER_ENDED, this.onStop)
    this.listenTo(this.container, Events.CONTAINER_DESTROYED, this.onStop)
    this.listenTo(
      this.container,
      Events.CONTAINER_STATE_BUFFERING,
      this.onBuffering,
    )
    this.listenTo(
      this.container,
      Events.CONTAINER_STATE_BUFFERFULL,
      this.onBufferFull,
    )
    this.listenTo(this.container, Events.CONTAINER_STATS_ADD, this.onStatsAdd)
    this.listenTo(this.container, Events.CONTAINER_BITRATE, this.onStatsAdd)
    this.listenTo(
      this.container.playback,
      Events.PLAYBACK_STATS_ADD,
      this.onStatsAdd,
    )
  }

  /**
   * Startup time is measured from the play request to the first frame.
   */
  private onPlayIntent() {
    if (this.firstPlay) {
      // Restart on every request: a play() blocked by the autoplay policy
      // must not count the time until the viewer clicks play
      this.startupTimeInit = performance.now()
    }
  }

  private onPlay() {
    if (this.firstPlay) {
      this.firstPlay = false
      if (this.startupTimeInit) {
        this.startupTime = performance.now() - this.startupTimeInit
      }
    }
    this.playing = true
    this.paused = false
    this.startWatching()
    if (this.intervalId === null) {
      this.intervalId = setInterval(this.report.bind(this), this.reportInterval)
    }
  }

  private onPause() {
    if (this.paused) {
      return
    }
    this.paused = true
    this.playing = false
    this.stopWatching()
    this.stopRebuffering()
    this.stopReporting()
    // Flush what was collected since the last periodic report
    this.report()
  }

  private onStop() {
    this.playing = false
    this.stopWatching()
    this.stopReporting()
    // A paused playback has already sent its final report,
    // e.g. the `pause` event that precedes `ended`
    if (!this.paused) {
      this.report()
    }
  }

  private stopReporting() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private onBuffering() {
    this.stopWatching()
    this.buffering = true
    if (this.firstPlay || this.paused) {
      // Startup buffering is part of the startup time;
      // buffering while paused, e.g. after a seek, is not noticed by the viewer
      return
    }
    this.rebufferingTimeInit = performance.now()
    this.rebuffers++
  }

  private onBufferFull() {
    this.buffering = false
    this.stopRebuffering()
    this.startWatching()
  }

  private stopRebuffering() {
    if (this.rebufferingTimeInit) {
      this.rebufferingTime += this.getRebufferingTime()
      this.rebufferingTimeInit = 0
    }
  }

  private startWatching() {
    if (this.playing && !this.buffering && !this.watchingSince) {
      this.watchingSince = performance.now()
    }
  }

  private stopWatching() {
    if (this.watchingSince) {
      this.watchingTime += performance.now() - this.watchingSince
      this.watchingSince = 0
    }
  }

  private getRebufferingTime(): number {
    return performance.now() - this.rebufferingTimeInit
  }

  private getWatchingTime(): number {
    return this.watchingSince
      ? this.watchingTime + (performance.now() - this.watchingSince)
      : this.watchingTime
  }

  private isRebuffering(): boolean {
    return !!this.rebufferingTimeInit
  }

  private onStatsAdd(metric: Record<string, any>) {
    $.extend(this.externalMetrics, metric)
  }

  getStats(): PlaybackStatsReport {
    const metrics = {
      startupTime: this.startupTime,
      rebuffers: this.rebuffers,
      rebufferingTime: this.isRebuffering()
        ? this.rebufferingTime + this.getRebufferingTime()
        : this.rebufferingTime,
      watchingTime: this.getWatchingTime(),
    }
    $.extend(metrics, this.externalMetrics)
    return metrics
  }

  private report() {
    this.container.statsReport(this.getStats())
  }
}
