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
} from 'dashjs'

import {
  PlaybackError,
  PlaybackErrorCode,
  QualityLevel,
  TimePosition,
  TimeValue,
  VTTCueInfo,
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
  _levels: QualityLevel[] = []

  _currentLevel: number = AUTO

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
  }

  _setup() {
    const dash = MediaPlayer().create()
    this._dash = dash
    this._dash.initialize()

    if (this.options.dash) {
      const settings = $.extend(
        true,
        {
          streaming: {
            text: {
              defaultEnabled: false,
              dispatchForManualRendering: true,
            },
          },
        },
        this.options.dash,
      )
      this._dash.updateSettings(settings)
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

    this._dash.on(MediaPlayer.events.TRACK_CHANGE_RENDERED, (e: any) => {
      if ((e as TrackChangeRenderedEvent).mediaType === 'audio') {
        this.trigger(
          Events.PLAYBACK_AUDIO_CHANGED,
          toClapprTrack(e.newMediaInfo),
        )
      }
    })

    this._dash.on(MediaPlayer.events.CUE_ENTER, (e: CueEnterEvent) => {
      this.oncueenter?.({
        end: e.end,
        id: e.id,
        start: e.start,
        text: e.text,
      })
    })
    this._dash.on(MediaPlayer.events.CUE_EXIT, (e: CueExitEvent) => {
      this.oncueexit?.({
        id: e.id,
      })
    })
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

  // getProgramDateTime() {
  //   return this._programDateTime
  // }

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
      // firstFragDateTime: this.getProgramDateTime(), // TODO figure out if needed
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
      return false
    }
    return (
      this._dash?.getDvrWindow()?.size >= this._minDvrSize &&
      this.getPlaybackType() === Playback.LIVE
    )
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

  override destroy() {
    this._stopTimeUpdateTimer()
    this.destroyInstance()
    return super.destroy()
  }

  _updatePlaybackType() {
    const prevPlaybackType = this._playbackType
    // @ts-ignore
    this._playbackType = this._dash.isDynamic() ? Playback.LIVE : Playback.VOD
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
    this._dash?.setTextTrack(id)
  }

  /**
   * @override
   */
  get closedCaptionsTracks() {
    const tt = this.getTextTracks()
    return tt;
  }

  private getTextTracks() {
    return this._dash?.getTracksFor('text').map((t: DashMediaInfo, index: number) => ({
      id: index,
      name: getTextTrackLabel(t) || "",
      track: {
        id: index,
        label: getTextTrackLabel(t) || "",
        language: t.lang,
        mode: "hidden",
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
