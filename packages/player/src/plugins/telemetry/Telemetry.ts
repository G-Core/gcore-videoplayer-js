// An example implementation of client side performancestatistics
import { Container, ContainerPlugin, Events } from '@clappr/core'
import { reportError, trace } from '@gcorevideo/utils'
import assert from 'assert'

import type { TimePosition, TimeValue } from '../../playback.types.js'
import type { PlaybackType } from '../../types.js'

import { CLAPPR_VERSION } from '../../build.js'

const WATCH_CUTOFF = 5

const STALL_MEASURE_PERIOD = 10

const T = 'plugins.telemetry'

/**
 * Telemetry event data
 */
export type TelemetryEventData = StallEventData | InitEventData | StartEventData | WatchEventData

/**
 * Playback stall event data
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

export interface InitEventData {
  event: TelemetryEvent.Init
}

export interface StartEventData {
  event: TelemetryEvent.Start
}

export interface WatchEventData {
  event: TelemetryEvent.Watch
}

/**
 * Telemetry record
 */
export type TelemetryRecord = {
  type: PlaybackType
} & TelemetryEventData;

/**
 * Callback to send the telemetry record to the storage.
 * @param data - The telemetry record to send.
 */
type TelemetrySendFn = (data: TelemetryRecord) => void

/**
 * Plugin settings
 */
export interface TelemetryPluginSettings {
  /**
   * Sends the statistics record to the storage.
   * The actual delivery is presumably async and batched.
   */
  send: TelemetrySendFn
}

/**
 * Telemetry event type
 */
export enum TelemetryEvent {
  Init = 1,
  Start,
  Watch,
  Stall,
}

/**
 * Collects and reports the performance statistics.
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

  private started = false

  private timeStart = 0

  private stallSent = false

  private stallLastTime = 0

  private watchSent = false

  private bufTracking = false

  private numStalls = 0

  /**
   * The time when buffering last started.
   */
  private bufLastStarted = 0

  /**
   * The accumulated buffering duration.
   */
  private stallAcc = 0

  constructor(container: Container) {
    super(container)
    
    assert(
      this.options.telemetry &&
        typeof this.options.telemetry.send === 'function',
      'Telemetry plugin configuration is invalid: `send` option is required',
    )
  }

  /**
   * @internal
   */
  override bindEvents() {
    // TODO remove this
    // this.listenToOnce(
    //   this.container,
    //   CUSTOM_EVENTS_CONTAINER_START,
    //   this.onStart,
    // )

    this.listenToOnce(this.container, Events.CONTAINER_READY, this.onReady)
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
  }

  private startLevelSwitch() {
    this.bufTracking = false
  }

  private endLevelSwitch() {
    this.bufTracking = true
  }

  private onBuffering() {
    if (this.bufTracking) {
      this.bufLastStarted = performance.now()
    }
  }

  private onBufferFull() {
    if (this.bufTracking && this.bufLastStarted) {
      this.stallAcc += performance.now() - this.bufLastStarted
      this.numStalls++
    }
    this.bufTracking = true
  }

  private onReady() {
    this.sendInit()
    trace(`${T} onReady`, {
      autoPlay: this.options.autoPlay,
    })
    if (this.options.autoPlay) {
      this.onStart()
    } else {
      this.listenToOnce(
        this.container.playback,
        Events.PLAYBACK_PLAY_INTENT,
        this.onStart,
      )
    }
  }

  private sendInit() {
    this.send({event: TelemetryEvent.Init})
  }

  private send(event: TelemetryEventData) {
    (this.options.telemetry as TelemetryPluginSettings).send({
      type: this.container.getPlaybackType(),
      ...event,
    })
  }

  private sendStall(time: TimeValue) {
    // TODO don't send if no stalls?
    const res: TelemetryEventData = {
      event: TelemetryEvent.Stall,
      count: this.numStalls,
      time,
      total_ms: Math.round(this.stallAcc * 1000),
    }
    this.stallAcc = 0
    this.numStalls = 0
    this.send(res)
    this.stallSent = true
    this.stallLastTime = time
  }

  private onTimeUpdate({ current }: TimePosition) {
    if (!this.timeStart) {
      this.timeStart = current
    }
    try {
      const elapsed = current - this.timeStart
      const stallElapsed = current - this.stallLastTime

      if (!this.stallSent || stallElapsed >= STALL_MEASURE_PERIOD) {
        this.sendStall(current)
      }

      if (!this.watchSent && elapsed >= WATCH_CUTOFF) {
        this.watchSent = true
        this.send({
          event: TelemetryEvent.Watch,
        })
      }
    } catch (error) {
      reportError(error)
    }
  }

  private onStart() {
    if (this.started) {
      return
    }
    this.started = true
    this.send({
      event: TelemetryEvent.Start,
    })
  }
}
