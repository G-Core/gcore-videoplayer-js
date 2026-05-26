// This code is derived on works by Globo.com.
// This code is distributed under the terms of the Apache License 2.0.
// Original code's license can be found on
// https://github.com/clappr/clappr/blob/8752995ea439321ac7ca3cd35e8c64de7a3c3d17/LICENSE

import { Events, Log, Playback, PlayerError, Utils, $ } from '@clappr/core'
import { trace } from '@gcorevideo/utils'
import assert from 'assert'
import {
  ErrorEvent as DashErrorEvent,
  MediaPlayer,
  MediaPlayerClass,
  MediaPlayerErrorEvent,
  PlaybackErrorEvent as DashPlaybackErrorEvent,
  MediaInfo as DashMediaInfo,
  MetricEvent as DashMetricEvent,
  IManifestInfo,
  MediaInfo,
  QualityChangeRenderedEvent,
  TrackChangeRenderedEvent,
  PlaybackRateChangedEvent,
  Representation,
  CueEnterEvent,
  CueExitEvent,
  FragmentLoadingCompletedEvent,
} from 'dashjs'

import {
  PlaybackError,
  PlaybackErrorCode,
  QualityLevel,
  TimePosition,
  TimeValue,
} from '../../playback.types.js'
import { isDashSource } from '../../utils/mediaSources.js'
import { BasePlayback } from '../BasePlayback.js'
import { LiveMetrics, PlaybackEvents, VTTCueInfo } from '../types.js'
import { AudioTrack } from '@clappr/core/types/base/playback/playback.js'

const AUTO = -1

const { now } = Utils

type PlaybackType =
  | typeof Playback.VOD
  | typeof Playback.LIVE
  | typeof Playback.AOD
  | typeof Playback.NO_OP

type PlaylistType = string // TODO union

type LocalTimeCorrelation = {
  local: number
  remote: number
}

const T = 'playback.dash'

export default class DashPlayback extends BasePlayback {
  _levels: QualityLevel[] = []

  _currentLevel: number = AUTO

  _currentTextTrackId: number = -1

  // true when the actual duration is longer than hlsjs's live sync point
  // when this is false playableRegionDuration will be the actual duration
  // when this is true playableRegionDuration will exclude the time after the sync point
  _durationExcludesAfterLiveSyncPoint: boolean = false

  _isReadyState: boolean = false

  // if content is removed from the beginning then this empty area should
  // be ignored. "playableRegionDuration" excludes the empty area
  _playableRegionDuration: number = 0

  // for hls streams which have dvr with a sliding window,
  // the content at the start of the playlist is removed as new
  // content is appended at the end.
  // this means the actual playable start time will increase as the
  // start content is deleted
  // For streams with dvr where the entire recording is kept from the
  // beginning this should stay as 0
  _playableRegionStartTime: number = 0

  _playbackType: PlaybackType = Playback.VOD

  // #EXT-X-PLAYLIST-TYPE
  _playlistType: PlaylistType | null = null

  _programDateTime: TimeValue = 0

  _dash: MediaPlayerClass | null = null

  _extrapolatedWindowDuration: number = 0

  _lastDuration: TimeValue | null = null

  _lastTimeUpdate: TimePosition = { current: 0, total: 0 }

  // {local, remote} remote is the time in the video element that should represent 0
  //                 local is the system time when the 'remote' measurment took place
  _localStartTimeCorrelation: LocalTimeCorrelation | null = null

  // {local, remote} remote is the time in the video element that should represents the end
  //                 local is the system time when the 'remote' measurment took place
  _localEndTimeCorrelation: LocalTimeCorrelation | null = null

  startChangeQuality = false

  manifestInfo: IManifestInfo | null = null

  _timeUpdateTimer: ReturnType<typeof setInterval> | null = null

  private _accumulatedSegmentDrift = 0

  private _lastSegmentDrift: number | null = null

  private _liveMetricsTimer: ReturnType<typeof setInterval> | null = null

  private _liveResyncTimer: ReturnType<typeof setTimeout> | null = null

  private _liveResyncInProgress = false

  private _dvrInUse = false

  private _minDvrSize = 60

  oncueenter: ((e: VTTCueInfo) => void) | null = null

  oncueexit: ((e: { id: string }) => void) | null = null

  get name() {
    return 'dash'
  }

  get levels(): QualityLevel[] {
    return this._levels
  }

  get currentLevel(): number {
    return this._currentLevel
  }

  get isReady() {
    return this._isReadyState
  }

  set currentLevel(id: number) {
    this._currentLevel = id

    this.trigger(Events.PLAYBACK_LEVEL_SWITCH_START)

    assert.ok(
      this._dash,
      'An instance of dashjs MediaPlayer is required to switch levels',
    )
    const dash = this._dash

    const settings = $.extend(true, {}, this.options.dash, {
      streaming: {
        abr: {
          autoSwitchBitrate: {
            video: id === -1,
          },
        },
      },
    })

    dash.updateSettings(settings)
    if (id !== -1) {
      this._dash.setRepresentationForTypeByIndex('video', id)
    }
    if (this._playbackType === Playback.VOD) {
      const curr_time = this._dash.time()

      this.startChangeQuality = true
      dash.seek(0)
      setTimeout(() => {
        dash.seek(curr_time)
        dash.play()
        this.startChangeQuality = false
      }, 100)
    }
  }

  get _startTime() {
    // TODO review
    if (
      this._playbackType === Playback.LIVE &&
      this._playlistType !== 'EVENT'
    ) {
      return this._extrapolatedStartTime
    }

    return this._playableRegionStartTime
  }

  get _now() {
    return now()
  }

  // the time in the video element which should represent the start of the sliding window
  // extrapolated to increase in real time (instead of jumping as the early segments are removed)
  get _extrapolatedStartTime() {
    if (!this._localStartTimeCorrelation) {
      return this._playableRegionStartTime
    }

    const corr = this._localStartTimeCorrelation
    const timePassed = this._now - corr.local
    const extrapolatedWindowStartTime = (corr.remote + timePassed) / 1000

    // cap at the end of the extrapolated window duration
    return Math.min(
      extrapolatedWindowStartTime,
      this._playableRegionStartTime + this._extrapolatedWindowDuration,
    )
  }

  // the time in the video element which should represent the end of the content
  // extrapolated to increase in real time (instead of jumping as segments are added)
  get _extrapolatedEndTime() {
    const actualEndTime =
      this._playableRegionStartTime + this._playableRegionDuration

    if (!this._localEndTimeCorrelation) {
      return actualEndTime
    }

    const corr = this._localEndTimeCorrelation
    const timePassed = this._now - corr.local
    const extrapolatedEndTime = (corr.remote + timePassed) / 1000

    return Math.max(
      actualEndTime - this._extrapolatedWindowDuration,
      Math.min(extrapolatedEndTime, actualEndTime),
    )
  }

  get _duration() {
    if (!this._dash) {
      return Infinity
    }
    return this._dash.duration() ?? Infinity
  }

  constructor(options: any, i18n: string, playerError?: any) {
    super(options, i18n, playerError)
    if (this.options.playbackType) {
      this._playbackType = this.options.playbackType
    }
    this._minDvrSize =
      typeof this.options.dashMinimumDvrSize === 'undefined'
        ? 30
        : this.options.dashMinimumDvrSize
  }

  _setup() {
    const dash = MediaPlayer().create()
    this._dash = dash
    this._dash.initialize()

    const { requestInterceptor, ...dashSettings } = ((this.options.dash ?? {}) as Record<string, unknown>)

    const liveDelaySettings = typeof this.options.liveDelay === 'number'
      ? {
          streaming: {
            delay: {
              liveDelay: this.options.liveDelay,
              // Prevent the manifest's suggestedPresentationDelay from overriding
              // the explicitly requested live delay.
              useSuggestedPresentationDelay: false,
            },
          },
        }
      : {}

    const settings = $.extend(
      true,
      {
        streaming: {
          text: {
            defaultEnabled: false,
            // NOTE: dispatchForManualRendering is not correctly implemented in DASH.js;
            // it does not work when there are multiple text tracks.
            // CUE_ENTER and CUE_EXIT events might be dispatched additionally
            // for a track, other than the currently active one.
            // dispatchForManualRendering: true, // TODO only when useNativeSubtitles is not true?
          },
          gaps: {
            jumpGaps: true,
            jumpLargeGaps: true,
          },
          liveCatchup: {
            // Proportional catch-up: rate scales smoothly with latency distance
            // instead of binary 1.0×/1.5× switching. Near target → minimal speed
            // increase; far behind → approaches 1.5×. Override via
            // options.dash.streaming.liveCatchup.mode.
            mode: 'liveCatchupModeLoLP',
            // Require at least half the live-delay target in buffer before
            // activating catch-up. Prevents the post-stall "live-edge chasing"
            // cascade where the player catches up too aggressively on a thin
            // buffer and immediately stalls again. Override via
            // options.dash.streaming.liveCatchup.playbackBufferMin.
            playbackBufferMin: typeof this.options.liveDelay === 'number'
              ? this.options.liveDelay * 0.5
              : 1.0,
            // Hard seek to live edge if drifted more than 3 seconds.
            maxDrift: 3.0,
            // Cap catch-up speed at 1.15× to avoid audible distortion and
            // aggressive buffer depletion on micro-stalls.
            playbackRate: { min: 1.0, max: 1.15 },
          },
        },
      },
      liveDelaySettings,
      // options.dash takes highest priority — overrides both defaults above.
      dashSettings,
    )
    this._dash.updateSettings(settings)

    // Live DASH manifests (type="dynamic") must be re-fetched at every
    // minimumUpdatePeriod interval. CDNs often serve MPDs with a non-zero
    // Cache-Control max-age, which causes the browser to return a stale cached
    // copy for every periodic refresh request, making the player appear to read
    // the manifest only once. Appending a timestamp query param forces the
    // browser to treat each refresh as a distinct URL and go to the origin.
    // Safe for VOD too: only one MPD fetch happens for static manifests.
    // Note: request.type ('mpd') is added by dash.js at runtime and is not in the
    // CommonMediaRequest type definition, hence the cast.
    this._dash.addRequestInterceptor((request) => {
      if ((request as any).type === 'mpd') {
        const sep = request.url.includes('?') ? '&' : '?'
        request.url = `${request.url}${sep}_t=${Date.now()}`
      }
      return Promise.resolve(request)
    })

    if (typeof requestInterceptor === 'function') {
      this._dash.addRequestInterceptor(requestInterceptor as Parameters<typeof this._dash.addRequestInterceptor>[0])
    }

    this._dash.attachView(this.el as HTMLMediaElement)

    this._dash.setAutoPlay(false)
    this._dash.attachSource(this.options.src)

    this._dash.on(MediaPlayer.events.ERROR, this._onDASHJSSError)
    this._dash.on(
      MediaPlayer.events.PLAYBACK_ERROR,
      this._onPlaybackError,
    )

    this._dash.on(MediaPlayer.events.STREAM_INITIALIZED, () => {
      const bitrates = dash.getRepresentationsByType('video')

      this._updatePlaybackType()
      this._fillLevels(bitrates)
      const currentLevel = dash.getCurrentRepresentationForType('video')
      if (currentLevel) {
        this.trigger(Events.PLAYBACK_BITRATE, this.getLevel(currentLevel.index))
      }

      dash.on(MediaPlayer.events.QUALITY_CHANGE_REQUESTED, (evt) => {
        const newLevel = this.getLevel(evt.newRepresentation.index)
        this.onLevelSwitch(newLevel)
      })

      this.checkAudioTracks()
    })

    this._dash.on(
      MediaPlayer.events.QUALITY_CHANGE_RENDERED,
      (evt: QualityChangeRenderedEvent) => {
        if (evt.mediaType === 'video') {
          // After a codec switch (resetSourceBuffersForTrackSwitch), the stream
          // re-initializes without firing STREAM_INITIALIZED again, so _levels
          // stays stale with the old codec's representations.  Detect the
          // mismatch and refresh before reporting the level change upstream.
          const incomingCodec = evt.newRepresentation.codecs
          if (incomingCodec && this._levels[evt.newRepresentation.index]?.codec !== incomingCodec) {
            this._fillLevels(this._dash!.getRepresentationsByType('video'))
          }
        }
        const currentLevel = this.getLevel(evt.newRepresentation.index)
        this.onLevelSwitchEnd(currentLevel)
      },
    )

    this._dash.on(
      MediaPlayer.events.METRIC_ADDED,
      (e: DashMetricEvent) => {
        // Listen for the first manifest request in order to update player UI
        if ((e.metric as string) === 'DVRInfo') {
          // TODO fix typings
          assert.ok(
            this._dash,
            'An instance of dashjs MediaPlayer is required to get metrics',
          )
          const dvrInfo = this._dash.getDashMetrics().getCurrentDVRInfo('video')
          if (dvrInfo) {
            // Extract time info
            this.manifestInfo = dvrInfo.manifestInfo
          }
        }
      },
    )

    this._dash.on(
      MediaPlayer.events.PLAYBACK_RATE_CHANGED,
      (e: PlaybackRateChangedEvent) => {
        this.trigger(PlaybackEvents.PLAYBACK_RATE_CHANGED, e.playbackRate)
      },
    )

    this._dash.on(
      MediaPlayer.events.FRAGMENT_LOADING_COMPLETED,
      (e: FragmentLoadingCompletedEvent) => {
        const req = e.request
        if (req.type !== 'MediaSegment' || req.mediaType !== 'video') {
          return
        }
        if (!req.requestEndDate || !req.startDate || !req.duration) {
          return
        }
        // Skip LL-DASH chunks (parts) — their 500 ms duration produces
        // noisy per-part readings; we only want full-segment drift.
        if (req.duration < 1) {
          return
        }
        const transferMs = req.requestEndDate.getTime() - req.startDate.getTime()
        const drift = transferMs / 1000 - req.duration
        this._lastSegmentDrift = drift
        this._accumulatedSegmentDrift += drift
      },
    )

    this._dash.on(MediaPlayer.events.BUFFER_EMPTY, this._onBufferEmpty)
    this._dash.on(MediaPlayer.events.BUFFER_LOADED, this._onBufferLoaded)
    this._dash.on(MediaPlayer.events.PLAYBACK_WAITING, this._onPlaybackWaiting)
    this._dash.on(MediaPlayer.events.PLAYBACK_STALLED, this._onPlaybackWaiting)
  }

  render() {
    this._ready()

    return super.render()
  }

  _ready() {
    !this._dash && this._setup()
    super._ready()
  }

  private override _setupSrc() {
    // this playback manages the src on the video element itself
  }

  _startTimeUpdateTimer() {
    this._stopTimeUpdateTimer()
    this._timeUpdateTimer = setInterval(() => {
      this._onDurationChange()
      // this._onTimeUpdate()
    }, 100)
  }

  _stopTimeUpdateTimer() {
    if (this._timeUpdateTimer) {
      clearInterval(this._timeUpdateTimer)
    }
  }

  private _startLiveMetricsTimer() {
    this._stopLiveMetricsTimer()
    this._liveMetricsTimer = setInterval(() => {
      if (!this._dash) {
        return
      }
      const liveLatency = this._dash.getCurrentLiveLatency()
      const targetLatency = this._dash.getTargetLiveDelay()
      if (isNaN(liveLatency) || liveLatency <= 0) {
        return
      }
      const metrics: LiveMetrics = {
        liveLatency,
        targetLatency,
        ...(this._lastSegmentDrift !== null && {
          segmentDrift: this._lastSegmentDrift,
          accumulatedDrift: this._accumulatedSegmentDrift,
        }),
      }
      this.trigger(PlaybackEvents.LIVE_METRICS, metrics)
    }, 1000)
  }

  private _stopLiveMetricsTimer() {
    if (this._liveMetricsTimer) {
      clearInterval(this._liveMetricsTimer)
      this._liveMetricsTimer = null
    }
  }

  // getProgramDateTime() {
  //   return this._programDateTime
  // }

  // the duration on the video element itself should not be used
  // as this does not necesarily represent the duration of the stream
  // https://github.com/clappr/clappr/issues/668#issuecomment-157036678
  getDuration(): TimeValue {
    const type = this.getPlaybackType()
    if (type === Playback.LIVE) {
      const dvrWindow = this._dash?.getDvrWindow()
      if (dvrWindow) {
        trace(`${T} getDuration LIVE`, { size: dvrWindow.size })
        return dvrWindow.size
      }
    }

    assert.ok(
      this._duration !== null,
      'A valid duration is required to get the duration',
    )
    trace(`${T} getDuration VOD`, { duration: this._duration, type })
    return this._duration
  }

  getCurrentTime(): TimeValue {
    if (!this._dash) {
      return 0
    }
    const absoluteTime = this._dash.time()
    const type = this.getPlaybackType()

    if (type === Playback.LIVE) {
      const windowSize = this.getDuration()
      const liveEdge = this._dash.duration()
      const windowStart = liveEdge - windowSize
      const relativeTime = Math.max(0, absoluteTime - windowStart)
      trace(`${T} getCurrentTime LIVE`, { absoluteTime, liveEdge, windowSize, windowStart, relativeTime })
      return relativeTime
    }

    trace(`${T} getCurrentTime VOD`, { absoluteTime, type })
    return absoluteTime
  }

  private _getIsDvr(time: number): boolean {
    if (!this.dvrEnabled) {
      return false
    }

    // time is relative now, so we just check if it is sufficiently behind the end of the window (duration)
    return time < this.getDuration() - 10
  }

  // the time that "0" now represents relative to when playback started
  // for a stream with a sliding window this will increase as content is
  // removed from the beginning
  getStartTimeOffset(): TimeValue {
    return this._startTime
  }

  override seekPercentage(percentage: number) {
    let seekTo = this._duration

    if (percentage > 0) {
      assert.ok(
        this._duration !== null,
        'A valid duration is required to seek by percentage',
      )
      seekTo = this._duration * (percentage / 100)
    }

    assert.ok(seekTo !== null, 'A valid seek time is required')
    this.seek(seekTo)
  }

  override seek(time: TimeValue) {
    if (!this._dash) {
      return
    }

    let targetTime = time
    if (this.getPlaybackType() === Playback.LIVE) {
      const windowSize = this.getDuration()
      const liveEdge = this._dash.duration()
      const windowStart = liveEdge - windowSize
      targetTime = time + windowStart
      const isDvr = this._getIsDvr(time)
      this._updateDvr(isDvr)
    }


    this._dash.seek(targetTime)
  }

  seekToLivePoint() {
    this.seek(this.getDuration())
  }

  _updateDvr(status: boolean) {
    trace(`${T} _updateDvr`, { status, prev: this._dvrInUse })
    this._dvrInUse = status
    this.trigger(Events.PLAYBACK_DVR, status)
    this.trigger(Events.PLAYBACK_STATS_ADD, { dvr: status })

    if (this._dash) {
      const settings = {
        streaming: {
          liveCatchup: {
            enabled: !status,
            // Lock playback rate to 1.0 when in DVR to prevent dash.js from
            // trying to catch up to the live edge.
            playbackRate: status ? { min: 1.0, max: 1.0 } : { min: 1.0, max: 1.15 },
            // Set an extremely high drift threshold in DVR mode to prevent
            // automatic "hard" seeks to the live edge.
            maxDrift: status ? 1000000 : 3.0,
          },
          gaps: {
            // Disable gap jumping in DVR to prevent accidental skips to live.
            jumpGaps: !status,
            jumpLargeGaps: !status,
          },
        },
      }
      trace(`${T} updating dash settings`, settings)
      this._dash.updateSettings(settings)
    }
  }

  // TODO move to the base class
  override _updateSettings() {
    if (this._playbackType === Playback.VOD) {
      // @ts-expect-error
      this.settings.left = ['playpause', 'position', 'duration']
    } else if (this.dvrEnabled) {
      // @ts-expect-error
      this.settings.left = ['playpause']
    } else {
      // @ts-expect-error
      this.settings.left = ['playstop']
    }
    // @ts-expect-error
    this.settings.seekEnabled = this.isSeekEnabled()
    this.trigger(Events.PLAYBACK_SETTINGSUPDATE)
  }

  private _onPlaybackError = (event: DashPlaybackErrorEvent) => {
    trace(`${T} _onPlaybackError`, { type: event.type, code: event.error.code, message: event.error.message })
  }

  private _onDASHJSSError = (event: DashErrorEvent) => {
    this._stopTimeUpdateTimer()

    // Note that the other error types are deprecated
    const e = (event as MediaPlayerErrorEvent).error
    switch (e.code) {
      // TODO test handling of these errors
      case MediaPlayer.errors.MANIFEST_LOADER_PARSING_FAILURE_ERROR_CODE:
      case MediaPlayer.errors.MANIFEST_LOADER_LOADING_FAILURE_ERROR_CODE:
      case MediaPlayer.errors.DOWNLOAD_ERROR_ID_MANIFEST_CODE:
      case MediaPlayer.errors.DOWNLOAD_ERROR_ID_CONTENT_CODE:
      case MediaPlayer.errors.DOWNLOAD_ERROR_ID_INITIALIZATION_CODE:
      // TODO these probably indicate a broken manifest and should be treated by removing the source
      case MediaPlayer.errors.MANIFEST_ERROR_ID_NOSTREAMS_CODE:
      case MediaPlayer.errors.MANIFEST_ERROR_ID_PARSE_CODE:
      case MediaPlayer.errors.MANIFEST_ERROR_ID_MULTIPLEXED_CODE:
      case MediaPlayer.errors.MEDIASOURCE_TYPE_UNSUPPORTED_CODE:
      case MediaPlayer.errors.SEGMENT_BASE_LOADER_ERROR_CODE:
        this.triggerError({
          code: PlaybackErrorCode.MediaSourceUnavailable,
          message: e.message,
          description: e.message,
          level: PlayerError.Levels.FATAL,
        })
        break
      // TODO more cases
      default:
        this.triggerError({
          code: PlaybackErrorCode.Generic,
          message: e.message,
          description: e.message,
          level: PlayerError.Levels.FATAL,
        })
    }
  }

  private triggerError(
    error: Pick<PlaybackError, 'code' | 'message' | 'description' | 'level'>,
  ) {
    // this triggers Events.ERROR to be handled by the UI
    this.trigger(
      Events.PLAYBACK_ERROR,
      this.createError(error, {
        useCodePrefix: false,
      }),
    )
    // only reset the dash player in 10ms async, so that the rest of the
    // calling function finishes
    setTimeout(() => {
      this.stop()
    }, 10)
  }

  override _onTimeUpdate() {
    if (this.startChangeQuality) {
      return
    }
    const update: TimePosition = {
      current: this.getCurrentTime(),
      total: this.getDuration(),
    }

    // Diagnostic log to see what the UI is receiving
    if (this.getPlaybackType() === Playback.LIVE) {
      trace(`${T} [UI Sync]`, { current: update.current, total: update.total, abs: this._dash?.time(), type: this.getPlaybackType() })
    }

    const isSame =
      this._lastTimeUpdate &&
      update.current === this._lastTimeUpdate.current &&
      update.total === this._lastTimeUpdate.total

    if (!isSame) {
      this._lastTimeUpdate = update
      this.trigger(Events.PLAYBACK_TIMEUPDATE, update, this.name)
    }
  }

  override _onDurationChange() {
    // We use the reported duration (which might be the window size)
    const duration = this.getDuration()

    if (this._lastDuration === duration) {
      return
    }

    this._lastDuration = duration
    super._onDurationChange()
  }

  override _onSeeking() {
    this.trigger(Events.PLAYBACK_SEEK, this.getCurrentTime())
  }

  override _onPause() {
    this.trigger(Events.PLAYBACK_PAUSE, this.name)
  }

  get dvrEnabled() {
    if (!this._dash) {
      return false
    }
    const dvrWindow = this._dash.getDvrWindow()
    const size = dvrWindow ? dvrWindow.size : 0
    const playbackType = this.getPlaybackType()
    const enabled = size >= this._minDvrSize && playbackType === Playback.LIVE
    trace(`${T} dvrEnabled`, { size, minDvrSize: this._minDvrSize, playbackType, enabled })
    return enabled
  }

  override _onProgress() {
    const buffer =
      // @ts-expect-error
      this._dash.getDashMetrics().getCurrentBufferLevel('video') ||
      // @ts-expect-error
      this._dash.getDashMetrics().getCurrentBufferLevel('audio')

    const progress = {
      start: this.getCurrentTime(),
      current: this.getCurrentTime() + buffer,
      total: this.getDuration(),
    }

    this.trigger(Events.PLAYBACK_PROGRESS, progress, {})
  }

  override play() {
    !this._dash && this._setup()
    assert(this._dash, 'An instance of dashjs MediaPlayer is required to play')
    const dash = this._dash
    super.play()
    // super.play() → el.play() races with PlaybackController.addAllListeners():
    // for autoPlay, the stream is not yet initialized when play() is first called,
    // so the native 'play' event fires before dash.js registers its listener and
    // ManifestUpdater never receives PLAYBACK_STARTED → the manifest refresh timer
    // never starts → live manifests are only fetched once.
    // this._dash.play() uses dash.js's internal playOnceInitialized mechanism to
    // defer el.play() until after addAllListeners() is set up, guaranteeing
    // PLAYBACK_STARTED fires and the ManifestUpdater 4-second refresh timer starts.
    dash.play()
    this._startTimeUpdateTimer()
    this._startLiveMetricsTimer()
  }

  override pause() {
    if (!this._dash) {
      return
    }
    super.pause()
    if (this.dvrEnabled) {
      this._updateDvr(true)
    }
  }

  override stop() {
    if (this._dash) {
      this._stopTimeUpdateTimer()
      this._stopLiveMetricsTimer()
      this._clearLiveResyncTimer()
      this._liveResyncInProgress = false
      this._accumulatedSegmentDrift = 0
      this._lastSegmentDrift = null
      this._dvrInUse = false
      this.destroyInstance()
      super.stop()
    }
  }

  private destroyInstance() {
    if (this._dash) {
      this._dash.off(MediaPlayer.events.ERROR, this._onDASHJSSError)
      this._dash.off(
        MediaPlayer.events.PLAYBACK_ERROR,
        this._onPlaybackError,
      )
      this._dash.off(
        MediaPlayer.events.MANIFEST_LOADED,
        this.getDuration,
      )
      this._dash.off(MediaPlayer.events.BUFFER_EMPTY, this._onBufferEmpty)
      this._dash.off(MediaPlayer.events.BUFFER_LOADED, this._onBufferLoaded)
      this._dash.off(MediaPlayer.events.PLAYBACK_WAITING, this._onPlaybackWaiting)
      this._dash.off(MediaPlayer.events.PLAYBACK_STALLED, this._onPlaybackWaiting)
      const tracks = this._dash.getTracksFor('text')
      tracks.forEach(track => {
        if (track.id) {
          this._dash!.removeExternalSubtitleById(track.id)
        }
      })
      this._dash.reset()
      this._dash.destroy()
      this._dash = null
    }
  }

  private _onBufferEmpty = () => {
    if (this._playbackType !== Playback.LIVE) return
    trace(`${T} _onBufferEmpty`, { dvrInUse: this._dvrInUse })
    if (this._resyncToLive('buffer-empty')) return
    if (this._liveResyncTimer !== null) return
    this._liveResyncTimer = setTimeout(() => {
      this._liveResyncTimer = null
      this._resyncToLive('buffer-empty-delayed')
    }, 500)
  }

  private _onBufferLoaded = () => {
    this._clearLiveResyncTimer()
  }

  private _onPlaybackWaiting = () => {
    trace(`${T} _onPlaybackWaiting`, { dvrInUse: this._dvrInUse })
    this._resyncToLive('playback-waiting')
  }

  private _clearLiveResyncTimer() {
    if (this._liveResyncTimer !== null) {
      clearTimeout(this._liveResyncTimer)
      this._liveResyncTimer = null
    }
  }

  private _resyncToLive(reason: string) {
    if (!this._dash || this._playbackType !== Playback.LIVE) return false
    
    const currentTime = this._dash.time()
    const liveLatency = this._dash.getCurrentLiveLatency()
    const targetDelay = this._dash.getTargetLiveDelay()
    const dvrWindow = this._dash.getDvrWindow()
    const dvrSize = dvrWindow ? dvrWindow.size : 0

    const isDeepInDvr = liveLatency > this._minDvrSize
    const guardActive = this._liveResyncInProgress || this._dvrInUse || isDeepInDvr

    trace(`${T} _resyncToLive check`, {
      reason,
      guardActive,
      dvrInUse: this._dvrInUse,
      isDeepInDvr,
      resyncInProgress: this._liveResyncInProgress,
      currentTime,
      liveLatency,
      targetDelay,
      dvrSize
    })

    if (guardActive) {
      trace(`${T} _resyncToLive skipping`, { reason: 'guard-active', dvr: this._dvrInUse, deep: isDeepInDvr, resync: this._liveResyncInProgress })
      return false
    }

    if (isNaN(liveLatency) || liveLatency <= 0) return false
    if (isNaN(targetDelay) || targetDelay <= 0) return false

    const latencyDrift = liveLatency - targetDelay
    const shouldResync =
      latencyDrift > Math.max(1, targetDelay) ||
      liveLatency > targetDelay * 2

    trace(`${T} _resyncToLive decision`, { shouldResync, latencyDrift })

    if (!shouldResync) return false

    const liveEdge = currentTime + liveLatency
    const seekTo = liveEdge - targetDelay
    
    trace(`${T} _resyncToLive executing seek`, { liveEdge, seekTo, current: currentTime })

    if (seekTo <= currentTime) return false

    this._liveResyncInProgress = true
    setTimeout(() => { this._liveResyncInProgress = false }, 5000)

    this._dash.seek(seekTo)
    return true
  }

  override destroy() {
    this._stopTimeUpdateTimer()
    this.destroyInstance()
    return super.destroy()
  }

  _updatePlaybackType() {
    const prevPlaybackType = this._playbackType
    // @ts-ignore
    this._playbackType = this._dash.isDynamic() ? Playback.LIVE : Playback.VOD
    trace(`${T} _updatePlaybackType`, { prev: prevPlaybackType, current: this._playbackType, isDynamic: this._dash?.isDynamic() })
    if (prevPlaybackType !== this._playbackType) {
      this._updateSettings()
    }
  }

  private _fillLevels(levels: Representation[]) {
    this._levels = levels.map((level) => {
      return {
        level: level.index,
        bitrate: level.bitrateInKbit * 1000,
        width: level.width,
        height: level.height,
        codec: level.codecs || undefined,
      }
    })
    this.trigger(Events.PLAYBACK_LEVELS_AVAILABLE, this._levels)
  }

  private onLevelSwitch(currentLevel: QualityLevel) {
    // TODO check the two below
    this.trigger(Events.PLAYBACK_LEVEL_SWITCH, currentLevel)
  }

  private onLevelSwitchEnd(currentLevel: QualityLevel) {
    this.trigger(Events.PLAYBACK_LEVEL_SWITCH_END)
    const isHD =
      currentLevel.height >= 720 || currentLevel.bitrate / 1000 >= 2000
    this.trigger(Events.PLAYBACK_HIGHDEFINITIONUPDATE, isHD)
    this.trigger(Events.PLAYBACK_BITRATE, currentLevel)
  }

  getPlaybackType() {
    const type = this._playbackType
    // Log.info(`${T} getPlaybackType`, { type })
    return type
  }

  isSeekEnabled() {
    return this._playbackType === Playback.VOD || this.dvrEnabled
  }

  private getLevel(quality: number): QualityLevel {
    const level = this.levels.find((level) => level.level === quality)
    assert.ok(level, 'Invalid quality level')
    return level
  }

  setPlaybackRate(rate: number) {
    this._dash?.setPlaybackRate(rate)
  }

  get audioTracks(): AudioTrack[] {
    assert.ok(this._dash, 'DASH.js MediaPlayer is not initialized')
    const tracks = this._dash.getTracksFor('audio')
    return tracks.map(toClapprTrack)
  }

  // @ts-expect-error
  get currentAudioTrack(): AudioTrack | null {
    assert.ok(this._dash, 'DASH.js MediaPlayer is not initialized')
    const t = this._dash.getCurrentTrackFor('audio')
    if (!t) {
      return null
    }
    return toClapprTrack(t)
  }

  override switchAudioTrack(id: string): void {
    assert.ok(this._dash, 'DASH.js MediaPlayer is not initialized')
    const tracks = this._dash.getTracksFor('audio')
    const track = tracks.find((t) => t.id === id)
    assert.ok(track, 'Invalid audio track ID')
    this._dash.setCurrentTrack(track)
  }

  override load(srcUrl: string) {
    this._stopTimeUpdateTimer()
    this.options.src = srcUrl
    // TODO destroy the instance first?
    this.destroyInstance()
    this._setup()
  }

  private checkAudioTracks() {
    // @ts-ignore
    const tracks = this._dash.getTracksFor('audio')
    if (tracks.length) {
      this.trigger(Events.PLAYBACK_AUDIO_AVAILABLE, tracks.map(toClapprTrack))
    }
  }

  /**
   * @override
   */
  _handleTextTrackChange() {
    super._handleTextTrackChange()
    this._dash?.setTextTrack(this.closedCaptionsTrackId)
  }

  setTextTrack(id: number) {
    this._currentTextTrackId = id
    this._dash?.setTextTrack(id)
  }

  /**
   * @override
   */
  get closedCaptionsTracks() {
    return this.getTextTracks()
  }

  private getTextTracks() {
    return this._dash?.getTracksFor('text').map((t: DashMediaInfo, index: number) => ({
      id: index,
      name: getTextTrackLabel(t) || "",
      track: {
        id: index,
        label: getTextTrackLabel(t) || "",
        language: t.lang,
        mode: this._currentTextTrackId === index ? "showing" : "hidden",
      },
    })) || []
  }
}

function getTextTrackLabel(t: DashMediaInfo) {
  return t.labels.find((l) => !l.lang || l.lang === t.lang)?.text
}

DashPlayback.canPlay = function (resource, mimeType) {
  if (!isDashSource(resource, mimeType)) {
    return false
  }
  const ms = window.MediaSource
  const mms =
    'ManagedMediaSource' in window ? window.ManagedMediaSource : undefined
  const wms =
    'WebKitMediaSource' in window ? window.WebKitMediaSource : undefined
  const ctor = ms || mms || wms
  return typeof ctor === 'function'
}

function toClapprTrack(t: MediaInfo): AudioTrack {
  return {
    id: t.id,
    kind: t.roles && t.roles?.length > 0 ? t.roles[0] : 'main', // TODO
    label: t.labels.map((l) => l.text).join(' '), // TODO
    language: t.lang,
  } as AudioTrack
}
