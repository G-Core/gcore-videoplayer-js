// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Events, HTML5Video, Log, Playback, Utils } from '@clappr/core'
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

import { PlaybackErrorCode, QualityLevel, TimePosition, TimeUpdate, TimeValue } from '../../playback.types.js'

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

const T = 'DashPlayback'

// @ts-expect-error
export default class DashPlayback extends HTML5Video {
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

    // TODO use $.extend
    const settings = this.options.dash ? structuredClone(this.options.dash) : {}
    settings.streaming = settings.streaming || {}
    settings.streaming.abr = settings.streaming.abr || {}
    settings.streaming.abr.autoSwitchBitrate =
      settings.streaming.abr.autoSwitchBitrate || {}
    settings.streaming.abr.autoSwitchBitrate.video = id === -1

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
      // TODO use $.extend
      const settings = structuredClone(this.options.dash)
      if (!settings.streaming) {
        settings.streaming = {}
      }
      if (!settings.streaming.text) {
        settings.streaming.text = {
          defaultEnabled: false,
        }
      }
      this._dash.updateSettings(this.options.dash)
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
      dash.on(DASHJS.MediaPlayer.events.QUALITY_CHANGE_REQUESTED, (evt) => {
        // TODO
        assert.ok(
          this._levels,
          'An array of levels is required to change quality',
        )
        const newLevel = this._levels.find(
          (level) => level.level === evt.newQuality,
        ) // TODO or simply this._levels[evt.newQuality]?
        assert.ok(newLevel, 'A valid level is required to change quality')
        this.onLevelSwitch(newLevel)
      })
    })

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

    this._dash.on(DASHJS.MediaPlayer.events.PLAYBACK_RATE_CHANGED, () => {
      this.trigger('dash:playback-rate-changed')
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
      this._onTimeUpdate()
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

  seekPercentage(percentage: number) {
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

  seek(time: TimeValue) {
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
    // TODO figure out what's for
    this._stopTimeUpdateTimer()

    const e = (event as MediaPlayerErrorEvent).error
    switch (e.code) {
      case DASHJS.MediaPlayer.errors.MANIFEST_LOADER_PARSING_FAILURE_ERROR_CODE:
      case DASHJS.MediaPlayer.errors.MANIFEST_LOADER_LOADING_FAILURE_ERROR_CODE:
      case DASHJS.MediaPlayer.errors.DOWNLOAD_ERROR_ID_MANIFEST_CODE:
        this.trigger(Events.PLAYBACK_ERROR, this.createError({
          code: PlaybackErrorCode.MediaSourceUnavailable,
          message: e.message,
        }))
        break;
      // TODO more cases
      default:
        this.trigger(Events.PLAYBACK_ERROR, this.createError({
          code: PlaybackErrorCode.Generic,
          message: e.message,
        }))
    }

    // only reset the dash player in 10ms async, so that the rest of the
    // calling function finishes
    setTimeout(() => {
      assert.ok(
        this._dash,
        'An instance of dashjs MediaPlayer is required to reset',
      )
      this._dash.reset()
    }, 10)
  }

  _onTimeUpdate() {
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

  _onDurationChange() {
    const duration = this.getDuration()

    if (this._lastDuration === duration) {
      return
    }

    this._lastDuration = duration
    super._onDurationChange()
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

  _onProgress() {
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

  play() {
    trace(`${T} play`, { dash: !!this._dash })
    if (!this._dash) {
      this._setup()
    }

    super.play()
    this._startTimeUpdateTimer()
  }

  pause() {
    if (!this._dash) {
      return
    }

    super.pause()
    if (this.dvrEnabled) {
      this._updateDvr(true)
    }
  }

  stop() {
    if (this._dash) {
      this._stopTimeUpdateTimer()
      this._dash.reset()
      super.stop()
      this._dash = null
    }
  }

  destroy() {
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
    this.trigger(Events.PLAYBACK_LEVEL_SWITCH_END)
    const isHD = (currentLevel.height >= 720 || (currentLevel.bitrate / 1000) >= 2000);
    this.trigger(Events.PLAYBACK_HIGHDEFINITIONUPDATE, isHD);
    this.trigger(Events.PLAYBACK_BITRATE, currentLevel)
  }

  getPlaybackType() {
    return this._playbackType
  }

  isSeekEnabled() {
    return this._playbackType === Playback.VOD || this.dvrEnabled
  }
}

DashPlayback.canPlay = function (resource, mimeType) {
  const resourceParts = resource.split('?')[0].match(/.*\.(.*)$/) || []
  const isDash =
    (resourceParts.length > 1 && resourceParts[1].toLowerCase() === 'mpd') ||
    mimeType === 'application/dash+xml' ||
    mimeType === 'video/mp4'
  if (!isDash) {
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
