// An example implementation of client side performancestatistics
import { Container, ContainerPlugin, Events, Playback } from '@clappr/core'
import type { TimePosition, TimeValue } from '../..//playback.types'
import type { PlaybackType } from '../..//types'
import { reportError } from '@gcorevideo/utils'
import assert from 'assert'

import { CLAPPR_VERSION } from '../build.js'

const CUSTOM_EVENTS_CONTAINER_START = 'container:start'

const WATCH_CUTOFF = 5

const HEATMAP_INTERVAL = 10

type StatisticsEventData = Record<string, string | number | boolean>

type StatisticsRecord = {
  event: StatisticsEvent
  type: PlaybackType
} & StatisticsEventData

export type PluginSettings = {
  /**
   * Sends the statistics record to the storage.
   * The actual delivery is presumably async and batched.
   * @param data - The statistics record to send.
   */
  send: (data: StatisticsRecord) => void
}

type StatisticsEvent = 'init' | 'start' | 'watch' | 'heatmap'

// TODO rewrite as core plugin
export class Statistics extends ContainerPlugin {
  get name() {
    return 'statistics_gplayer'
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  private started = false

  private timeStart = 0

  private heatmapSent = false

  private heatmapLastTime = 0

  private watchSent = false

  private bufTracking = false

  private lags = 0

  /**
   * The time when buffering last started.
   */
  private bufLastStarted = 0

  /**
   * The accumulated buffering duration.
   */
  private bufAccDuration = 0

  constructor(container: Container) {
    super(container)
    assert(
      this.options.statistics &&
        typeof this.options.statistics.send === 'function',
      'Statistics plugin requires statistics options',
    )
  }

  override bindEvents() {
    // TODO remove this
    this.listenToOnce(
      this.container,
      CUSTOM_EVENTS_CONTAINER_START,
      this.onStart,
    )

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
      this.onTimeUpdateLive,
    )
    this.listenTo(
      this.container.playback,
      Events.PLAYBACK_LEVEL_SWITCH_START,
      this.startLevelSwitch,
    )
    this.listenTo(
      this.container.playback,
      Events.PLAYBACK_LEVEL_SWITCH_END,
      this.stopLevelSwitch,
    )
  }

  private startLevelSwitch() {
    this.bufTracking = false
  }

  private stopLevelSwitch() {
    this.bufTracking = true
  }

  private onBuffering() {
    if (this.bufTracking) {
      this.bufLastStarted = performance.now()
    }
  }

  private onBufferFull() {
    if (this.bufTracking && this.bufLastStarted) {
      this.bufAccDuration += performance.now() - this.bufLastStarted
      this.lags++
    }
    this.bufTracking = true
  }

  private onReady() {
    this.initEvent()
    if (this.options.autoPlay) {
      this.onStart()
    }
  }

  private initEvent() {
    this.sendMessage('init')
  }

  private sendMessage(state: StatisticsEvent) {
    this.send(state, {
      // embed_url: this.options.referer,
      // user_agent: Browser.userAgent
    })
  }

  private send(event: StatisticsEvent, data: StatisticsEventData = {}) {
    ;(this.options.statistics as PluginSettings).send({
      event,
      type: this.container.getPlaybackType(),
      ...data,
    })
  }

  private sendHeatmap(time: TimeValue) {
    const res: StatisticsEventData = {
      buffering: Math.round(this.bufAccDuration),
      lags: this.lags,
    }

    this.bufAccDuration = 0
    this.lags = 0
    if (this.container.getPlaybackType() === Playback.VOD) {
      res.timestamp = time
    }
    this.send('heatmap', res)
    this.heatmapSent = true
    this.heatmapLastTime = time
  }

  private onTimeUpdateLive({ current }: TimePosition) {
    // TODO check the `current` values for the live streams
    if (!this.timeStart) {
      this.timeStart = current
    }
    try {
      const elapsed = current - this.timeStart
      const heatmapElapsed = current - this.heatmapLastTime

      // TODO check if the heatmap is only needed for the live streams
      if (!this.heatmapSent || heatmapElapsed >= HEATMAP_INTERVAL) {
        this.sendHeatmap(current)
      }

      if (!this.watchSent && elapsed >= WATCH_CUTOFF) {
        this.watchSent = true
        this.sendMessage('watch')
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
    this.sendMessage('start')
  }
}
