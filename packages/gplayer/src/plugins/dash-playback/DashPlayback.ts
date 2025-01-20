// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Events, HTML5Video, Log, Playback, Utils } from '@clappr/core'
import assert from 'assert'
import DASHJS, {
  ErrorEvent as DashErrorEvent,
  PlaybackErrorEvent as DashPlaybackErrorEvent,
  type BitrateInfo as DashBitrateInfo,
  MetricEvent as DashMetricEvent,
  IManifestInfo,
} from 'dashjs'
import { trace } from '../../trace/index.js'

import { BitrateInfo, QualityLevel, TimePosition, TimeValue } from '../../playback.types.js'

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

  // #EXT-X-TARGETDURATION
  _segmentTargetDuration: TimeValue | null = null

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

    // TODO use $.extend
    const settings = this.options.dash ? structuredClone(this.options.dash) : {}
    settings.streaming = settings.streaming || {}
    settings.streaming.abr = settings.streaming.abr || {}
    settings.streaming.abr.autoSwitchBitrate =
      settings.streaming.abr.autoSwitchBitrate || {}
    settings.streaming.abr.autoSwitchBitrate.video = id === -1

    assert.ok(
      this._dash,
      'An instance of dashjs MediaPlayer is required to switch levels',
    )
    const dash = this._dash
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
  _setupSrc() {
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
    // e.g. can be < 0 if user pauses near the start
    // eventually they will then be kicked to the end by hlsjs if they run out of buffer
    // before the official start time
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

  _updateSettings() {
    if (this._playbackType === Playback.VOD) {
      this.settings.left = ['playpause', 'position', 'duration']
    } else if (this.dvrEnabled) {
      this.settings.left = ['playpause']
    } else {
      this.settings.left = ['playstop']
    }

    this.settings.seekEnabled = this.isSeekEnabled()
    this.trigger(Events.PLAYBACK_SETTINGSUPDATE)
  }

  _onPlaybackError = (event: DashPlaybackErrorEvent) => {
    // TODO
  }

  _onDASHJSSError = (event: DashErrorEvent) => {
    // TODO
    // only report/handle errors if they are fatal
    // hlsjs should automatically handle non fatal errors
    this._stopTimeUpdateTimer()
    if (event.error === 'capability' && event.event === 'mediasource') {
      // No support for MSE
      const formattedError = this.createError(event.error)

      this.trigger(Events.PLAYBACK_ERROR, formattedError)
      Log.error(
        'The media cannot be played because it requires a feature ' +
          'that your browser does not support.',
      )
    } else if (
      event.error === 'manifestError' &&
      // Manifest type not supported
      (event.event.id === 'createParser' ||
        // Codec(s) not supported
        event.event.id === 'codec' ||
        // No streams available to stream
        event.event.id === 'nostreams' ||
        // Error creating Stream object
        event.event.id === 'nostreamscomposed' ||
        // syntax error parsing the manifest
        event.event.id === 'parse' ||
        // a stream has multiplexed audio+video
        event.event.id === 'multiplexedrep')
    ) {
      // These errors have useful error messages, so we forward it on
      const formattedError = this.createError(event.error)

      this.trigger(Events.PLAYBACK_ERROR, formattedError)
      if (event.error) {
        Log.error(event.event.message)
      }
    } else if (event.error === 'mediasource') {
      // This error happens when dash.js fails to allocate a SourceBuffer
      // OR the underlying video element throws a `MediaError`.
      // If it's a buffer allocation fail, the message states which buffer
      // (audio/video/text) failed allocation.
      // If it's a `MediaError`, dash.js inspects the error object for
      // additional information to append to the error type.
      const formattedError = this.createError(event.error)

      this.trigger(Events.PLAYBACK_ERROR, formattedError)
      Log.error(event.event)
    } else if (
      event.error === 'capability' &&
      event.event === 'encryptedmedia'
    ) {
      // Browser doesn't support EME

      const formattedError = this.createError(event.error)

      this.trigger(Events.PLAYBACK_ERROR, formattedError)
      Log.error(
        'The media cannot be played because it requires encryption ' +
          'that your browser does not support.',
      )
    } else if (event.error === 'key_session') {
      // This block handles pretty much all errors thrown by the
      // encryption subsystem
      const formattedError = this.createError(event.error)

      this.trigger(Events.PLAYBACK_ERROR, formattedError)
      Log.error(event.event)
    } else if (event.error === 'download') {
      const formattedError = this.createError(event.error)

      this.trigger(Events.PLAYBACK_ERROR, formattedError)
      Log.error(
        'The media playback was aborted because too many consecutive ' +
          'download errors occurred.',
      )
      // } else if (event.error === 'mssError') {
      //   const formattedError = this.createError(event.error);

      //   this.trigger(Events.PLAYBACK_ERROR, formattedError);
      //   if (event.error) {
      //     Log.error(event.error.message);
      //   }
    } else {
      // ignore the error
      if (typeof event.error === 'object') {
        const formattedError = this.createError(event.error)

        this.trigger(Events.PLAYBACK_ERROR, formattedError)
        Log.error(event.error.message)
      } else {
        Log.error(event.error)
      }
      return
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
    const update = {
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
    assert.ok(
      this._dash,
      'An instance of dashjs MediaPlayer is required to get the DVR status',
    )
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
    this._playbackType = this._dash.isDynamic() ? Playback.LIVE : Playback.VOD
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
  const ms = window.MediaSource
  const mms =
    'ManagedMediaSource' in window ? window.ManagedMediaSource : undefined
  const wms =
    'WebKitMediaSource' in window ? window.WebKitMediaSource : undefined
  const ctor = ms || mms || wms

  const hasSupport = typeof ctor === 'function'
  trace(`${T} canPlay`, {
    hasSupport,
    isDash,
    resource,
    ms: typeof ms === 'function',
    mms: typeof mms === 'function',
    wms: typeof wms === 'function',
  })
  return !!(hasSupport && isDash)
}
