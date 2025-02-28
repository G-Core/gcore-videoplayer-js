// This code is derived on works by Globo.com.
// This code is distributed under the terms of the Apache License 2.0.
// Original code's license can be found on
// https://github.com/clappr/clappr/blob/8752995ea439321ac7ca3cd35e8c64de7a3c3d17/LICENSE

import { Events, Log, Playback, PlayerError, Utils, $ } from '@clappr/core'
import { trace } from '@gcorevideo/utils'
import assert from 'assert'
import DASHJS, {
  ErrorEvent as DashErrorEvent,
  MediaPlayerErrorEvent,
  PlaybackErrorEvent as DashPlaybackErrorEvent,
  type BitrateInfo as DashBitrateInfo,
  MetricEvent as DashMetricEvent,
  IManifestInfo,
} from 'dashjs'

import {
  PlaybackError,
  PlaybackErrorCode,
  QualityLevel,
  TimePosition,
  TimeUpdate,
  TimeValue,
} from '../../playback.types.js'
import { isDashSource } from '../../utils/mediaSources.js'
import { BasePlayback } from '../BasePlayback.js'
import { PlaybackEvents } from '../types.js'
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
  _levels: QualityLevel[] | null = null

  _currentLevel: number | null = null

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

  // #EXT-X-PROGRAM-DATE-TIME
  _programDateTime: TimeValue = 0

  _dash: DASHJS.MediaPlayerClass | null = null

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

  get name() {
    return 'dash'
  }

  get levels(): QualityLevel[] {
    return this._levels || []
  }

  get currentLevel(): number {
    if (this._currentLevel === null) {
      return AUTO
    }
    // 0 is a valid level ID
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
      this._dash.setQualityFor('video', id)
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
  }

  _setup() {
    const dash = DASHJS.MediaPlayer().create()
    this._dash = dash
    this._dash.initialize()

    if (this.options.dash) {
      const settings = $.extend(
        true,
        {
          streaming: {
            text: {
              defaultEnabled: false,
            },
          },
        },
        this.options.dash,
      )
      this._dash.updateSettings(settings)
    }

    this._dash.attachView(this.el)

    this._dash.setAutoPlay(false)
    this._dash.attachSource(this.options.src)

    this._dash.on(DASHJS.MediaPlayer.events.ERROR, this._onDASHJSSError)
    this._dash.on(
      DASHJS.MediaPlayer.events.PLAYBACK_ERROR,
      this._onPlaybackError,
    )

    this._dash.on(DASHJS.MediaPlayer.events.STREAM_INITIALIZED, () => {
      const bitrates = dash.getBitrateInfoListFor('video')

      this._updatePlaybackType()
      this._fillLevels(bitrates)
      const currentLevel = dash.getQualityFor('video')
      if (currentLevel !== -1) {
        this.trigger(Events.PLAYBACK_BITRATE, this.getLevel(currentLevel))
      }

      dash.on(DASHJS.MediaPlayer.events.QUALITY_CHANGE_REQUESTED, (evt) => {
        const newLevel = this.getLevel(evt.newQuality)
        this.onLevelSwitch(newLevel)
      })

      this.checkAudioTracks()
    })

    this._dash.on(
      DASHJS.MediaPlayer.events.QUALITY_CHANGE_RENDERED,
      (evt: DASHJS.QualityChangeRenderedEvent) => {
        const currentLevel = this.getLevel(evt.newQuality)
        this.onLevelSwitchEnd(currentLevel)
      },
    )

    this._dash.on(
      DASHJS.MediaPlayer.events.METRIC_ADDED,
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
      DASHJS.MediaPlayer.events.PLAYBACK_RATE_CHANGED,
      (e: DASHJS.PlaybackRateChangedEvent) => {
        this.trigger(PlaybackEvents.PLAYBACK_RATE_CHANGED, e.playbackRate)
      },
    )

    this._dash.on(DASHJS.MediaPlayer.events.TRACK_CHANGE_RENDERED, (e: any) => {
      if ((e as DASHJS.TrackChangeRenderedEvent).mediaType === 'audio') {
        this.trigger(
          Events.PLAYBACK_AUDIO_CHANGED,
          toClapprTrack(e.newMediaInfo),
        )
      }
    })
  }

  render() {
    this._ready()

    return super.render()
  }

  _ready() {
    this._isReadyState = true
    this.trigger(Events.PLAYBACK_READY, this.name)
  }

  // override
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

  getProgramDateTime() {
    return this._programDateTime
  }

  // the duration on the video element itself should not be used
  // as this does not necesarily represent the duration of the stream
  // https://github.com/clappr/clappr/issues/668#issuecomment-157036678
  getDuration(): TimeValue {
    assert.ok(
      this._duration !== null,
      'A valid duration is required to get the duration',
    )
    return this._duration
  }

  getCurrentTime(): TimeValue {
    return this._dash ? this._dash.time() : 0
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
    if (time < 0) {
      // eslint-disable-next-line max-len
      Log.warn(
        'Attempt to seek to a negative time. Resetting to live point. Use seekToLivePoint() to seek to the live point.',
      )
      time = this.getDuration()
    }
    this.dvrEnabled && this._updateDvr(time < this.getDuration() - 10)
    assert.ok(
      this._dash,
      'An instance of dashjs MediaPlayer is required to seek',
    )
    this._dash.seek(time)
  }

  seekToLivePoint() {
    this.seek(this.getDuration())
  }

  _updateDvr(status: boolean) {
    this.trigger(Events.PLAYBACK_DVR, status)
    this.trigger(Events.PLAYBACK_STATS_ADD, { dvr: status })
  }

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
    // TODO
    trace(`${T} _onPlaybackError`, { event })
  }

  private _onDASHJSSError = (event: DashErrorEvent) => {
    trace(`${T} _onDASHJSSError`, { event })
    this._stopTimeUpdateTimer()

    // Note that the other error types are deprecated
    const e = (event as MediaPlayerErrorEvent).error
    switch (e.code) {
      // TODO test handling of these errors
      case DASHJS.MediaPlayer.errors.MANIFEST_LOADER_PARSING_FAILURE_ERROR_CODE:
      case DASHJS.MediaPlayer.errors.MANIFEST_LOADER_LOADING_FAILURE_ERROR_CODE:
      case DASHJS.MediaPlayer.errors.DOWNLOAD_ERROR_ID_MANIFEST_CODE:
      case DASHJS.MediaPlayer.errors.DOWNLOAD_ERROR_ID_CONTENT_CODE:
      case DASHJS.MediaPlayer.errors.DOWNLOAD_ERROR_ID_INITIALIZATION_CODE:
      // TODO these probably indicate a broken manifest and should be treated by removing the source
      case DASHJS.MediaPlayer.errors.MANIFEST_ERROR_ID_NOSTREAMS_CODE:
      case DASHJS.MediaPlayer.errors.MANIFEST_ERROR_ID_PARSE_CODE:
      case DASHJS.MediaPlayer.errors.MANIFEST_ERROR_ID_MULTIPLEXED_CODE:
      case DASHJS.MediaPlayer.errors.MEDIASOURCE_TYPE_UNSUPPORTED_CODE:
      case DASHJS.MediaPlayer.errors.SEGMENT_BASE_LOADER_ERROR_CODE:
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
    trace(`${T} triggerError`, { error })

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
    const update: TimeUpdate = {
      current: this.getCurrentTime(),
      total: this.getDuration(),
      firstFragDateTime: this.getProgramDateTime(),
    }
    const isSame =
      this._lastTimeUpdate &&
      update.current === this._lastTimeUpdate.current &&
      update.total === this._lastTimeUpdate.total

    if (isSame) {
      return
    }
    this._lastTimeUpdate = update
    this.trigger(Events.PLAYBACK_TIMEUPDATE, update, this.name)
  }

  override _onDurationChange() {
    const duration = this.getDuration()

    if (this._lastDuration === duration) {
      return
    }

    this._lastDuration = duration
    super._onDurationChange() // will call _onTimeUpdate
  }

  get dvrEnabled() {
    if (!this._dash) {
      trace(`${T} dvrEnable no dash player instance`)
      return false
    }
    return (
      this._dash?.getDVRWindowSize() >= this._minDvrSize &&
      this.getPlaybackType() === Playback.LIVE
    )
  }

  override _onProgress() {
    if (!this._dash) {
      return
    }

    let buffer = this._dash.getDashMetrics().getCurrentBufferLevel('video')

    if (!buffer) {
      buffer = this._dash.getDashMetrics().getCurrentBufferLevel('audio')
    }
    const progress = {
      start: this.getCurrentTime(),
      current: this.getCurrentTime() + buffer,
      total: this.getDuration(),
    }

    this.trigger(Events.PLAYBACK_PROGRESS, progress, {})
  }

  override play() {
    trace(`${T} play`, { dash: !!this._dash })
    if (!this._dash) {
      this._setup()
    }

    super.play()
    this._startTimeUpdateTimer()
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
      this._dash.reset()
      super.stop()
      this._dash = null
    }
  }

  override destroy() {
    this._stopTimeUpdateTimer()
    if (this._dash) {
      this._dash.off(DASHJS.MediaPlayer.events.ERROR, this._onDASHJSSError)
      this._dash.off(
        DASHJS.MediaPlayer.events.PLAYBACK_ERROR,
        this._onPlaybackError,
      )
      this._dash.off(
        DASHJS.MediaPlayer.events.MANIFEST_LOADED,
        this.getDuration,
      )
      this._dash.reset()
    }
    this._dash = null
    return super.destroy()
  }

  _updatePlaybackType() {
    assert.ok(
      this._dash,
      'An instance of dashjs MediaPlayer is required to update the playback type',
    )
    const prevPlaybackType = this._playbackType
    this._playbackType = this._dash.isDynamic() ? Playback.LIVE : Playback.VOD
    if (prevPlaybackType !== this._playbackType) {
      this._updateSettings()
    }
  }

  _fillLevels(levels: DashBitrateInfo[]) {
    // TOOD check that levels[i].qualityIndex === i
    this._levels = levels.map((level) => {
      return {
        level: level.qualityIndex,
        bitrate: level.bitrate,
        width: level.width,
        height: level.height,
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
    return this._playbackType
  }

  isSeekEnabled() {
    return this._playbackType === Playback.VOD || this.dvrEnabled
  }

  private getLevel(quality: number) {
    const ret = this.levels.find((level) => level.level === quality)
    assert.ok(ret, 'Invalid quality level')
    return ret
  }

  setPlaybackRate(rate: number) {
    this._dash?.setPlaybackRate(rate)
  }

  get audioTracks(): AudioTrack[] {
    assert.ok(this._dash, 'DASH.js MediaPlayer is not initialized')
    const tracks = this._dash.getTracksFor('audio')
    trace(`${T} get audioTracks`, { tracks })
    return tracks.map(toClapprTrack)
  }

  // @ts-expect-error
  get currentAudioTrack(): AudioTrack | null {
    trace(`${T} get currentAudioTrack`)
    assert.ok(this._dash, 'DASH.js MediaPlayer is not initialized')
    const t = this._dash.getCurrentTrackFor('audio')
    if (!t) {
      return null
    }
    return toClapprTrack(t)
  }

  switchAudioTrack(id: string): void {
    assert.ok(this._dash, 'DASH.js MediaPlayer is not initialized')
    const tracks = this._dash.getTracksFor('audio')
    const track = tracks.find((t) => t.id === id)
    assert.ok(track, 'Invalid audio track ID')
    this._dash.setCurrentTrack(track)
  }

  private checkAudioTracks() {
    // @ts-ignore
    const tracks = this._dash.getTracksFor('audio')
    if (tracks.length) {
      this.trigger(Events.PLAYBACK_AUDIO_AVAILABLE, tracks.map(toClapprTrack))
    }
  }
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

function toClapprTrack(t: DASHJS.MediaInfo): AudioTrack {
  return {
    id: t.id,
    kind: t.roles && t.roles?.length > 0 ? t.roles[0] : 'main', // TODO
    label: t.labels.map((l) => l.text).join(' '), // TODO
    language: t.lang,
  } as AudioTrack
}
