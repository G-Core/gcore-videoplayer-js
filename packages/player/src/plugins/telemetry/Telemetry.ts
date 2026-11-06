// An example implementation of client side performancestatistics
import assert from 'assert'
import { Container, ContainerPlugin, Events } from '@clappr/core'

import { reportError, trace } from '@gcorevideo/utils'

import type { TimePosition, TimeValue } from '../../playback.types.js'
import { type PlaybackType } from '../../types.js'

import { CLAPPR_VERSION } from '../../build.js'

const DEFAULT_WATCH_CUTOFF = 5

const DEFAULT_PLAYBACK_REPORT_INTERVAL = 10

const T = 'plugins.telemetry'

/**
 * Telemetry event data
 * @beta
 */
export type TelemetryEventData =
  | StallEventData
  | InitEventData
  | StartEventData
  | WatchEventData
  | PlaybackEventData

/**
 * Telemetry event: playback stall
 * @beta
 * @deprecated {@link PlaybackEventData} is sent at a regular pace and bears the stall statistics information.
 */
export interface StallEventData {
  event: TelemetryEvent.Stall
  /**
   * Accumulated buffering duration over the measurement interval, ms
   */
  total_ms: number
  /**
   * Number of stalls
   */
  count: number
  /**
   * Playback time when the stall is reported at the end of a stall measurement interval, s
   */
  time: number
}

/**
 * Telemetry event: playback statistics
 * @beta
 */
export interface PlaybackEventData {
  event: TelemetryEvent.PlaybackReport
  /**
   * Accumulated buffering duration over the measurement interval, ms
   */
  stall_total_ms: number
  /**
   * Number of stalls
   */
  stall_count: number
  /**
   * Playback time when the event is reported, in seconds. @see {@link TimeValue}
   */
  time: number
}

/**
 * Telemetry event: playback is ready
 * @beta
 */
export interface InitEventData {
  event: TelemetryEvent.Init
}

/**
 * Telemetry event: playback start
 * @beta
 */
export interface StartEventData {
  event: TelemetryEvent.Start
}

/**
 * Telemetry watch: watch (playback has started)
 * @beta
 */
export interface WatchEventData {
  event: TelemetryEvent.Watch
}

/**
 * Telemetry record
 * @beta
 */
export type TelemetryRecord = {
  type: PlaybackType
} & TelemetryEventData

/**
 * Callback to send the telemetry record to the storage.
 * @param data - The telemetry record to send.
 * @beta
 */
export type TelemetrySendFn = (data: TelemetryRecord) => void

/**
 * Plugin settings
 * @beta
 */
export interface TelemetryPluginSettings {
  playbackReportInterval?: number

  /**
   * Sends the statistics record to the storage.
   * The actual delivery is presumably async and batched.
   */
  send: TelemetrySendFn

  watchCutoff?: number
}

/**
 * Telemetry event type
 * @beta
 */
export enum TelemetryEvent {
  Init = 1,
  Start,
  Watch,
  Stall, // deprecated
  PlaybackReport,
}

/**
 * `PLUGIN` that collects and reports the performance statistics.
 * @beta
 * @remarks
 * This plugin is experimental and its API is likely to change.
 *
 * Configuration options {@link TelemetryPluginSettings}
 *
 * @example
 * ```ts
 * import { Statistics } from '@gcorevideo/player'
 *
 * Player.registerPlugin(Statistics)
 *
 * const player = new Player({
 *   statistics: {
 *     send: (data) => {
 *        fetch('/stats', {
 *          method: 'POST',
 *          body: JSON.stringify(data),
 *          headers: { 'content-type': 'application/json' },
 *        })
 *     },
 *   },
 *   ...
 * })
 * ```
 */
export class Telemetry extends ContainerPlugin {
  /**
   * The name of the plugin.
   */
  get name() {
    return 'telemetry'
  }

  /**
   * The supported version of the plugin.
   */
  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  /**
   * The playback time of the last playback report.@see {@link TimeValue}
   */
  private lastPlaybackReportAt = 0

  /**
   * Playback time of the latest time update, s. @see {@link TimeValue}
   */
  private lastUpdateAt = 0

  private playbackReportInterval: number

  /**
   * Playback time, in seconds, where the playback started (from the beginning or after seeking).
   * For live streams, refers to the playback time within the current segment.
   * @see {@link TimeValue}
   */
  private playbackStartedAt = 0

  /**
   * Total number of buffering events.
   * Is reset after every playback report.
   */
  private stallCount = 0

  /**
   * The accumulated buffering duration, ms.
   * Is reset after every playback report.
   */
  private stallDurationTotal = 0

  /**
   * When false, the buffering events are ignored.
   */
  private stallTracking = false

  /**
   * The Playback time of the last buffering event. @see {@link TimeValue}
   */
  private stalledAt = 0

  private startSent = false

  private watchCutoff: number

  private watchSent = false

  constructor(container: Container) {
    super(container)
    assert(
      this.options.telemetry &&
        typeof this.options.telemetry.send === 'function',
      'Telemetry plugin configuration is invalid: `send` option is required',
    )
    const settings = this.options.telemetry as TelemetryPluginSettings
    this.playbackReportInterval =
      settings.playbackReportInterval || DEFAULT_PLAYBACK_REPORT_INTERVAL
    this.watchCutoff = settings.watchCutoff || DEFAULT_WATCH_CUTOFF
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenToOnce(
      this.container.playback,
      Events.PLAYBACK_READY,
      this.onReady,
    )
    this.listenTo(
      this.container.playback,
      Events.PLAYBACK_BUFFERING,
      this.onBuffering,
    )
    this.listenTo(
      this.container.playback,
      Events.PLAYBACK_BUFFERFULL,
      this.onBufferFull,
    )
    this.listenTo(
      this.container.playback,
      Events.PLAYBACK_TIMEUPDATE,
      this.onTimeUpdate,
    )
    this.listenTo(
      this.container.playback,
      Events.PLAYBACK_LEVEL_SWITCH_START,
      this.startLevelSwitch,
    )
    this.listenTo(
      this.container.playback,
      Events.PLAYBACK_LEVEL_SWITCH_END,
      this.endLevelSwitch,
    )
    this.listenTo(this.container.playback, Events.PLAYBACK_SEEK, this.onSeek)
  }

  private startLevelSwitch() {
    this.stallTracking = false
  }

  private endLevelSwitch() {
    this.stallTracking = true
  }

  private onBuffering() {
    if (this.stallTracking) {
      this.stalledAt = performance.now()
    }
  }

  private onBufferFull() {
    if (this.stallTracking && this.stalledAt) {
      this.stallDurationTotal += performance.now() - this.stalledAt
      this.stallCount++
    }
    this.stallTracking = true
  }

  private onReady() {
    this.sendInit()
    trace(`${T} onReady`, {
      autoPlay: this.options.autoPlay,
    })
    if (this.options.autoPlay) {
      this.sendStart()
      return
    }
    this.listenToOnce(
      this.container.playback,
      Events.PLAYBACK_PLAY_INTENT,
      this.sendStart,
    )
  }

  private onSeek(current: TimeValue) {
    trace(`${T} onSeek`, {
      current,
      stalledAt: this.stalledAt,
      stallCount: this.stallCount,
      stallDurationTotal: this.stallDurationTotal,
    })
    // `current` is the seek target already; report the
    // stalls accumulated up to the pre-seek position
    if (this.stallCount) {
      this.sendPlaybackReport(this.lastUpdateAt, true)
    }
    this.playbackStartedAt = 0
    this.lastPlaybackReportAt = 0
    this.stallCount = 0
    this.stallDurationTotal = 0
    this.stalledAt = 0
  }

  private sendInit() {
    this.send({ event: TelemetryEvent.Init })
  }

  private send(event: TelemetryEventData) {
    ;(this.options.telemetry as TelemetryPluginSettings).send({
      // Resolved per event: at PLAYBACK_READY the HLS/DASH
      // engines don't know yet whether the stream is live
      type: this.container.playback.getPlaybackType(),
      ...event,
    })
  }

  private onTimeUpdate({ current }: TimePosition) {
    this.lastUpdateAt = current
    if (!this.playbackStartedAt) {
      this.playbackStartedAt = current
    }
    try {
      const elapsed = current - this.playbackStartedAt

      if (!this.watchSent && elapsed >= this.watchCutoff) {
        this.watchSent = true
        this.send({
          event: TelemetryEvent.Watch,
        })
      }
      this.sendPlaybackReport(current)
    } catch (error) {
      reportError(error)
    }
  }

  private sendStart() {
    if (this.startSent) {
      return
    }
    this.startSent = true
    this.send({
      event: TelemetryEvent.Start,
    })
  }

  private sendPlaybackReport(time: TimeValue, force = false) {
    if (
      !force &&
      this.lastPlaybackReportAt &&
      time - this.lastPlaybackReportAt < this.playbackReportInterval
    ) {
      return
    }
    const res: TelemetryEventData = {
      event: TelemetryEvent.PlaybackReport,
      stall_count: this.stallCount,
      stall_total_ms: this.stallDurationTotal,
      time,
    }
    this.send(res)
    this.stallDurationTotal = 0
    this.stallCount = 0
    this.lastPlaybackReportAt = time
  }
}
