// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Events, HTML5Video, Log, Playback, /* PlayerError, */ Utils } from '@clappr/core';
import assert from 'assert'; // uses Node.js's assert types
import DASHJS,  {
  ErrorEvent as DashErrorEvent,
  PlaybackErrorEvent as DashPlaybackErrorEvent,
  type BitrateInfo,
  MetricEvent as DashMetricEvent,
  IManifestInfo
} from 'dashjs';

import { Duration, TimePosition, TimeValue } from '../../playback.types.js';

const AUTO = -1;

const { now } = Utils;

type PlaybackType =
  | typeof Playback.VOD
  | typeof Playback.LIVE
  | typeof Playback.AOD
  | typeof Playback.NO_OP;

type PlaylistType = string; // TODO union

type QualityLevel = {
  id: number;
  level: BitrateInfo;
};

type LocalTimeCorrelation = {
  local: number;
  remote: number;
}

const T = "DashPlayback";

export default class DashPlayback extends HTML5Video {
  _levels: QualityLevel[] | null = null;

  _currentLevel: number | null = null;

  _durationExcludesAfterLiveSyncPoint: boolean = false;

  _isReadyState: boolean = false;

  _playableRegionDuration: number = 0;

  _playableRegionStartTime: number = 0;

  _playbackType: PlaybackType = Playback.VOD;

  _playlistType: PlaylistType | null = null;

  // #EXT-X-PROGRAM-DATE-TIME
  _programDateTime: TimeValue = 0;

  _dash: DASHJS.MediaPlayerClass | null = null;

  _extrapolatedWindowDuration: number = 0;

  _extrapolatedWindowNumSegments: number = 0;

  _lastDuration: Duration | null = null;

  _lastTimeUpdate: TimePosition = { current: 0, total: 0 };

  _localStartTimeCorrelation: LocalTimeCorrelation | null = null;

  _localEndTimeCorrelation: LocalTimeCorrelation | null = null;

  _recoverAttemptsRemaining: number = 0;

  _recoveredAudioCodecError = false;

  _recoveredDecodingError = false;

  startChangeQuality = false;

  manifestInfo: IManifestInfo | null = null;

  // #EXT-X-TARGETDURATION
  _segmentTargetDuration: Duration | null = null;

  _timeUpdateTimer: ReturnType<typeof setInterval> | null = null;

  get name() {
    return 'dash';
  }

  get levels(): QualityLevel[] {
    return this._levels || [];
  }

  get currentLevel(): number {
    if (this._currentLevel === null) {
      return AUTO;
    }
    // 0 is a valid level ID
    return this._currentLevel;
  }

  get isReady() {
    return this._isReadyState;
  }

  set currentLevel(id) {
    this._currentLevel = id;

    this.trigger(Events.PLAYBACK_LEVEL_SWITCH_START);
    const cfg = {
      streaming: {
        abr: {
          autoSwitchBitrate: {
            video: id === -1,
          },
          ABRStrategy: 'abrL2A'
        }
      },
    };

    assert.ok(this._dash, 'An instance of dashjs MediaPlayer is required to switch levels');
    const dash = this._dash;
    this.options.dash && dash.updateSettings({ ...this.options.dash, ...cfg });
    if (id !== -1) {
      this._dash.setQualityFor('video', id);
    }
    if (this._playbackType === Playback.VOD) {
      const curr_time = this._dash.time();

      this.startChangeQuality = true;
      dash.seek(0);
      setTimeout(() => {
        dash.seek(curr_time);
        dash.play();
        this.startChangeQuality = false;
      }, 100);
    }
  }

  get _startTime() {
    if (this._playbackType === Playback.LIVE && this._playlistType !== 'EVENT') {
      return this._extrapolatedStartTime;
    }

    return this._playableRegionStartTime;
  }

  get _now() {
    return now();
  }

  // the time in the video element which should represent the start of the sliding window
  // extrapolated to increase in real time (instead of jumping as the early segments are removed)
  get _extrapolatedStartTime() {
    if (!this._localStartTimeCorrelation) {
      return this._playableRegionStartTime;
    }

    const corr = this._localStartTimeCorrelation;
    const timePassed = this._now - corr.local;
    const extrapolatedWindowStartTime = (corr.remote + timePassed) / 1000;

    // cap at the end of the extrapolated window duration
    return Math.min(extrapolatedWindowStartTime, this._playableRegionStartTime + this._extrapolatedWindowDuration);
  }

  // the time in the video element which should represent the end of the content
  // extrapolated to increase in real time (instead of jumping as segments are added)
  get _extrapolatedEndTime() {
    const actualEndTime = this._playableRegionStartTime + this._playableRegionDuration;

    if (!this._localEndTimeCorrelation) {
      return actualEndTime;
    }

    const corr = this._localEndTimeCorrelation;
    const timePassed = this._now - corr.local;
    const extrapolatedEndTime = (corr.remote + timePassed) / 1000;

    return Math.max(actualEndTime - this._extrapolatedWindowDuration, Math.min(extrapolatedEndTime, actualEndTime));
  }

  get _duration() {
    if (!this._dash) {
      return Infinity;
    }
    return this._dash.duration() ?? Infinity;
  }

  constructor(options: any, i18n: string, playerError?: any) {
    super(options, i18n, playerError);
    // backwards compatibility (TODO: remove on 0.3.0)
    // this.options.playback || (this.options.playback = this.options);
    // The size of the start time extrapolation window measured as a multiple of segments.
    // Should be 2 or higher, or 0 to disable. Should only need to be increased above 2 if more than one segment is
    // removed from the start of the playlist at a time. E.g if the playlist is cached for 10 seconds and new chunks are
    // added/removed every 5.
    this._extrapolatedWindowNumSegments = this.options.playback?.extrapolatedWindowNumSegments ?? 2;

    if (this.options.playbackType) {
      this._playbackType = this.options.playbackType;
    }
    // this._lastTimeUpdate = { current: 0, total: 0 };
    // this._lastDuration = null;
    // for hls streams which have dvr with a sliding window,
    // the content at the start of the playlist is removed as new
    // content is appended at the end.
    // this means the actual playable start time will increase as the
    // start content is deleted
    // For streams with dvr where the entire recording is kept from the
    // beginning this should stay as 0
    // this._playableRegionStartTime = 0;
    // {local, remote} remote is the time in the video element that should represent 0
    //                 local is the system time when the 'remote' measurment took place
    // this._localStartTimeCorrelation = null;
    // {local, remote} remote is the time in the video element that should represents the end
    //                 local is the system time when the 'remote' measurment took place
    // this._localEndTimeCorrelation = null;
    // if content is removed from the beginning then this empty area should
    // be ignored. "playableRegionDuration" excludes the empty area
    // this._playableRegionDuration = 0;
    // #EXT-X-PROGRAM-DATE-TIME
    // this._programDateTime = 0;

    // this.manifestInfo = null;
    // true when the actual duration is longer than hlsjs's live sync point
    // when this is false playableRegionDuration will be the actual duration
    // when this is true playableRegionDuration will exclude the time after the sync point
    // this._durationExcludesAfterLiveSyncPoint = false;
    // // #EXT-X-TARGETDURATION
    // this._segmentTargetDuration = null;
    // #EXT-X-PLAYLIST-TYPE
    // this._playlistType = null;
    if (this.options.hlsRecoverAttempts) {
      this._recoverAttemptsRemaining = this.options.hlsRecoverAttempts;
    }
  }

  _setup() {
    const dash = DASHJS.MediaPlayer().create();
    this._dash = dash;
    this._dash.initialize();

    const cfg = this.options.dash ?? {};

    cfg.streaming = cfg.streaming || {};
    cfg.streaming.text = cfg.streaming.text || { defaultEnabled: false };

    this.options.dash && this._dash.updateSettings(cfg);

    this._dash.attachView(this.el);

    this._dash.setAutoPlay(false);
    this._dash.attachSource(this.options.src);

    this._dash.on(DASHJS.MediaPlayer.events.ERROR, this._onDASHJSSError);
    this._dash.on(DASHJS.MediaPlayer.events.PLAYBACK_ERROR, this._onPlaybackError);

    this._dash.on(DASHJS.MediaPlayer.events.STREAM_INITIALIZED, () => {
      const bitrates = dash.getBitrateInfoListFor('video');

      this._updatePlaybackType();
      this._fillLevels(bitrates);
      dash.on(DASHJS.MediaPlayer.events.QUALITY_CHANGE_REQUESTED, (evt) => {
        // TODO
        assert.ok(this._levels, 'An array of levels is required to change quality');
        const newLevel = this._levels.find((level) => level.id === evt.newQuality); // TODO or simply this._levels[evt.newQuality]?
        assert.ok(newLevel, 'A valid level is required to change quality');
        this.onLevelSwitch(newLevel.level);
      });
    });

    this._dash.on(DASHJS.MediaPlayer.events.METRIC_ADDED, (e: DashMetricEvent) => {
      // Listen for the first manifest request in order to update player UI
      if ((e.metric as string) === 'DVRInfo') { // TODO fix typings
        assert.ok(this._dash, 'An instance of dashjs MediaPlayer is required to get metrics');
        const dvrInfo = this._dash.getDashMetrics().getCurrentDVRInfo('video');
        if (dvrInfo) {
          // Extract time info
          this.manifestInfo = dvrInfo.manifestInfo;
        }
      }
    });

    this._dash.on(DASHJS.MediaPlayer.events.PLAYBACK_RATE_CHANGED, () => {
      this.trigger('dash:playback-rate-changed');
    });
  }

  render() {
    this._ready();

    return super.render();
  }

  _ready() {
    this._isReadyState = true;
    this.trigger(Events.PLAYBACK_READY, this.name);
  }

  // TODO
  // _recover(evt, data, error) {
  //   console.warn('recover', evt, data, error);
  //   assert.ok(this._dash, 'An instance of dashjs MediaPlayer is required to recover');
  //   // TODO figure out what's going on here
  //   const dash = this._dash;
  //   if (!this._recoveredDecodingError) {
  //     this._recoveredDecodingError = true;
  //     // dash.recoverMediaError();
  //   } else if (!this._recoveredAudioCodecError) {
  //     this._recoveredAudioCodecError = true;
  //     // dash.swapAudioCodec();
  //     // dash.recoverMediaError();
  //   } else {
  //     // TODO what does it have to do with hlsjs?
  //     Log.error('hlsjs: failed to recover', { evt, data });
  //     error.level = PlayerError.Levels.FATAL;
  //     const formattedError = this.createError(error);

  //     this.trigger(Events.PLAYBACK_ERROR, formattedError);
  //     this.stop();
  //   }
  // }

  // override
  _setupSrc() {
    // this playback manages the src on the video element itself
  }

  _startTimeUpdateTimer() {
    this._stopTimeUpdateTimer();
    this._timeUpdateTimer = setInterval(() => {
      this._onDurationChange();
      this._onTimeUpdate();
    }, 100);
  }

  _stopTimeUpdateTimer() {
    if (this._timeUpdateTimer) {
      clearInterval(this._timeUpdateTimer);
    }
  }

  getProgramDateTime() {
    return this._programDateTime;
  }

  // the duration on the video element itself should not be used
  // as this does not necesarily represent the duration of the stream
  // https://github.com/clappr/clappr/issues/668#issuecomment-157036678
  getDuration(): Duration {
    assert.ok(this._duration !== null, 'A valid duration is required to get the duration');
    return this._duration;
  }

  getCurrentTime(): TimeValue {
    // e.g. can be < 0 if user pauses near the start
    // eventually they will then be kicked to the end by hlsjs if they run out of buffer
    // before the official start time
    return this._dash ? this._dash.time() : 0;
  }

  // the time that "0" now represents relative to when playback started
  // for a stream with a sliding window this will increase as content is
  // removed from the beginning
  getStartTimeOffset(): TimeValue {
    return this._startTime;
  }

  seekPercentage(percentage: number) {
    let seekTo = this._duration;

    if (percentage > 0) {
      assert.ok(this._duration !== null, 'A valid duration is required to seek by percentage');
      seekTo = this._duration * (percentage / 100);
    }

    assert.ok(seekTo !== null, 'A valid seek time is required');
    this.seek(seekTo);
  }

  seek(time: TimeValue) {
    if (time < 0) {
      // eslint-disable-next-line max-len
      Log.warn('Attempt to seek to a negative time. Resetting to live point. Use seekToLivePoint() to seek to the live point.');
      time = this.getDuration();
    }
    this.dvrEnabled && this._updateDvr(time < this.getDuration() - 10);
    assert.ok(this._dash, 'An instance of dashjs MediaPlayer is required to seek');
    this._dash.seek(time);
  }

  seekToLivePoint() {
    this.seek(this.getDuration());
  }

  _updateDvr(status: boolean) {
    this.trigger(Events.PLAYBACK_DVR, status);
    this.trigger(Events.PLAYBACK_STATS_ADD, { 'dvr': status });
  }

  _updateSettings() {
    if (this._playbackType === Playback.VOD) {
      this.settings.left =  ['playpause', 'position', 'duration'];
      // this.settings.left.push('playstop');
    } else if (this.dvrEnabled) {
      this.settings.left = ['playpause'];
    } else {
      this.settings.left = ['playstop'];
    }

    this.settings.seekEnabled = this.isSeekEnabled();
    this.trigger(Events.PLAYBACK_SETTINGSUPDATE);
  }

  _onPlaybackError = (event: DashPlaybackErrorEvent) => {
    // TODO
  }

  _onDASHJSSError = (event: DashErrorEvent) => {
    // TODO
    // only report/handle errors if they are fatal
    // hlsjs should automatically handle non fatal errors
    this._stopTimeUpdateTimer();
    if (event.error === 'capability' && event.event === 'mediasource') {
      // No support for MSE
      const formattedError = this.createError(event.error);

      this.trigger(Events.PLAYBACK_ERROR, formattedError);
      Log.error('The media cannot be played because it requires a feature ' +
        'that your browser does not support.');
    } else if (event.error === 'manifestError' && (
      // Manifest type not supported
      (event.event.id === 'createParser') ||
      // Codec(s) not supported
      (event.event.id === 'codec') ||
      // No streams available to stream
      (event.event.id === 'nostreams') ||
      // Error creating Stream object
      (event.event.id === 'nostreamscomposed') ||
      // syntax error parsing the manifest
      (event.event.id === 'parse') ||
      // a stream has multiplexed audio+video
      (event.event.id === 'multiplexedrep')
    )) {
      // These errors have useful error messages, so we forward it on
      const formattedError = this.createError(event.error);

      this.trigger(Events.PLAYBACK_ERROR, formattedError);
      if (event.error) {
        Log.error(event.event.message);
      }
    } else if (event.error === 'mediasource') {
      // This error happens when dash.js fails to allocate a SourceBuffer
      // OR the underlying video element throws a `MediaError`.
      // If it's a buffer allocation fail, the message states which buffer
      // (audio/video/text) failed allocation.
      // If it's a `MediaError`, dash.js inspects the error object for
      // additional information to append to the error type.
      const formattedError = this.createError(event.error);

      this.trigger(Events.PLAYBACK_ERROR, formattedError);
      Log.error(event.event);
    } else if (event.error === 'capability' && event.event === 'encryptedmedia') {
      // Browser doesn't support EME

      const formattedError = this.createError(event.error);

      this.trigger(Events.PLAYBACK_ERROR, formattedError);
      Log.error('The media cannot be played because it requires encryption ' +
        'that your browser does not support.');
    } else if (event.error === 'key_session') {
      // This block handles pretty much all errors thrown by the
      // encryption subsystem
      const formattedError = this.createError(event.error);

      this.trigger(Events.PLAYBACK_ERROR, formattedError);
      Log.error(event.event);
    } else if (event.error === 'download') {
      const formattedError = this.createError(event.error);

      this.trigger(Events.PLAYBACK_ERROR, formattedError);
      Log.error('The media playback was aborted because too many consecutive ' +
        'download errors occurred.');
    // } else if (event.error === 'mssError') {
    //   const formattedError = this.createError(event.error);

    //   this.trigger(Events.PLAYBACK_ERROR, formattedError);
    //   if (event.error) {
    //     Log.error(event.error.message);
    //   }
    } else {
      // ignore the error
      if (typeof event.error === "object") {
        const formattedError = this.createError(event.error);

        this.trigger(Events.PLAYBACK_ERROR, formattedError);
        Log.error(event.error.message);
      } else {
        Log.error(event.error);
      }
      return;
    }

    // only reset the dash player in 10ms async, so that the rest of the
    // calling function finishes
    setTimeout(() => {
      assert.ok(this._dash, 'An instance of dashjs MediaPlayer is required to reset');
      this._dash.reset();
    }, 10);
  }

  _onTimeUpdate() {
    if (this.startChangeQuality) {
      return;
    }
    const update = {
      current: this.getCurrentTime(),
      total: this.getDuration(),
      firstFragDateTime: this.getProgramDateTime()
    };
    const isSame = this._lastTimeUpdate && (
      update.current === this._lastTimeUpdate.current &&
      update.total === this._lastTimeUpdate.total);

    if (isSame) {
      return;
    }
    this._lastTimeUpdate = update;
    this.trigger(Events.PLAYBACK_TIMEUPDATE, update, this.name);
  }

  _onDurationChange() {
    const duration = this.getDuration();

    if (this._lastDuration === duration) {
      return;
    }

    this._lastDuration = duration;
    super._onDurationChange();
  }

  get dvrEnabled() {
    assert.ok(this._dash, 'An instance of dashjs MediaPlayer is required to get the DVR status');
    return this._dash?.getDVRWindowSize() >= this._minDvrSize && this.getPlaybackType() === Playback.LIVE;
  }

  _onProgress() {
    if (!this._dash) {
      return;
    }

    let buffer = this._dash.getDashMetrics().getCurrentBufferLevel('video');

    if (!buffer) {
      buffer = this._dash.getDashMetrics().getCurrentBufferLevel('audio');
    }
    const progress = {
      start: this.getCurrentTime(),
      current: this.getCurrentTime() + buffer,
      total: this.getDuration()
    };

    this.trigger(Events.PLAYBACK_PROGRESS, progress, {});
  }

  play() {
    if (!this._dash) {
      this._setup();
    }

    super.play();
    this._startTimeUpdateTimer();
  }

  pause() {
    if (!this._dash) {
      return;
    }

    super.pause();
    if (this.dvrEnabled) {
      this._updateDvr(true);
    }
  }

  stop() {
    if (this._dash) {
      this._stopTimeUpdateTimer();
      this._dash.reset();
      super.stop();
      this._dash = null;
    }
  }

  destroy() {
    this._stopTimeUpdateTimer();
    if (this._dash) {
      this._dash.off(DASHJS.MediaPlayer.events.ERROR, this._onDASHJSSError);
      this._dash.off(DASHJS.MediaPlayer.events.PLAYBACK_ERROR, this._onPlaybackError);
      this._dash.off(DASHJS.MediaPlayer.events.MANIFEST_LOADED, this.getDuration);
      this._dash.reset();
    }
    this._dash = null;
    return super.destroy();
  }

  _updatePlaybackType() {
    assert.ok(this._dash, 'An instance of dashjs MediaPlayer is required to update the playback type');
    this._playbackType = this._dash.isDynamic() ? Playback.LIVE : Playback.VOD;
  }

  _fillLevels(levels: BitrateInfo[]) {
    // TOOD check that levels[i].qualityIndex === i
    this._levels = levels.map((level) => {
      return { id: level.qualityIndex, level: level };
    });
    this.trigger(Events.PLAYBACK_LEVELS_AVAILABLE, this._levels);
  }

  // _onLevelUpdated(_: any, data) {
  //   this._segmentTargetDuration = data.details.targetduration;
  //   this._playlistType = data.details.type || null;

  //   let startTimeChanged = false;
  //   let durationChanged = false;
  //   const fragments = data.details.fragments;
  //   const previousPlayableRegionStartTime = this._playableRegionStartTime;
  //   const previousPlayableRegionDuration = this._playableRegionDuration;

  //   if (fragments.length === 0) {
  //     return;
  //   }

  //   // #EXT-X-PROGRAM-DATE-TIME
  //   if (fragments[0].rawProgramDateTime) {
  //     this._programDateTime = fragments[0].rawProgramDateTime;
  //   }

  //   if (this._playableRegionStartTime !== fragments[0].start) {
  //     startTimeChanged = true;
  //     this._playableRegionStartTime = fragments[0].start;
  //   }

  //   if (startTimeChanged) {
  //     if (!this._localStartTimeCorrelation) {
  //       // set the correlation to map to middle of the extrapolation window
  //       this._localStartTimeCorrelation = {
  //         local: this._now,
  //         remote: (fragments[0].start + (this._extrapolatedWindowDuration / 2)) * 1000
  //       };
  //     } else {
  //       // check if the correlation still works
  //       const corr = this._localStartTimeCorrelation;
  //       const timePassed = this._now - corr.local;
  //       // this should point to a time within the extrapolation window
  //       const startTime = (corr.remote + timePassed) / 1000;

  //       if (startTime < fragments[0].start) {
  //         // our start time is now earlier than the first chunk
  //         // (maybe the chunk was removed early)
  //         // reset correlation so that it sits at the beginning of the first available chunk
  //         this._localStartTimeCorrelation = {
  //           local: this._now,
  //           remote: fragments[0].start * 1000
  //         };
  //       } else if (startTime > previousPlayableRegionStartTime + this._extrapolatedWindowDuration) {
  //         // start time was past the end of the old extrapolation window (so would have been capped)
  //         // see if now that time would be inside the window, and if it would be set the correlation
  //         // so that it resumes from the time it was at at the end of the old window
  //         // update the correlation so that the time starts counting again from the value it's on now
  //         this._localStartTimeCorrelation = {
  //           local: this._now,
  //           remote: Math.max(
  //             fragments[0].start,
  //             previousPlayableRegionStartTime + this._extrapolatedWindowDuration
  //           ) * 1000
  //         };
  //       }
  //     }
  //   }

  //   let newDuration = data.details.totalduration;

  //   // if it's a live stream then shorten the duration to remove access
  //   // to the area after hlsjs's live sync point
  //   // seeks to areas after this point sometimes have issues
  //   if (this._playbackType === Playback.LIVE) {
  //     const fragmentTargetDuration = data.details.targetduration;
  //     const hlsjsConfig = this.options.playback.hlsjsConfig || {};
  //     // eslint-disable-next-line no-undef
  //     const liveSyncDurationCount = hlsjsConfig.liveSyncDurationCount || HLSJS.DefaultConfig.liveSyncDurationCount;
  //     const hiddenAreaDuration = fragmentTargetDuration * liveSyncDurationCount;

  //     if (hiddenAreaDuration <= newDuration) {
  //       newDuration -= hiddenAreaDuration;
  //       this._durationExcludesAfterLiveSyncPoint = true;
  //     } else {
  //       this._durationExcludesAfterLiveSyncPoint = false;
  //     }
  //   }

  //   if (newDuration !== this._playableRegionDuration) {
  //     durationChanged = true;
  //     this._playableRegionDuration = newDuration;
  //   }

  //   // Note the end time is not the playableRegionDuration
  //   // The end time will always increase even if content is removed from the beginning
  //   const endTime = fragments[0].start + newDuration;
  //   const previousEndTime = previousPlayableRegionStartTime + previousPlayableRegionDuration;
  //   const endTimeChanged = endTime !== previousEndTime;

  //   if (endTimeChanged) {
  //     if (!this._localEndTimeCorrelation) {
  //       // set the correlation to map to the end
  //       this._localEndTimeCorrelation = {
  //         local: this._now,
  //         remote: endTime * 1000
  //       };
  //     } else {
  //       // check if the correlation still works
  //       const corr = this._localEndTimeCorrelation;
  //       const timePassed = this._now - corr.local;
  //       // this should point to a time within the extrapolation window from the end
  //       const extrapolatedEndTime = (corr.remote + timePassed) / 1000;

  //       if (extrapolatedEndTime > endTime) {
  //         this._localEndTimeCorrelation = {
  //           local: this._now,
  //           remote: endTime * 1000
  //         };
  //       } else if (extrapolatedEndTime < endTime - this._extrapolatedWindowDuration) {
  //         // our extrapolated end time is now earlier than the extrapolation window from the actual end time
  //         // (maybe a chunk became available early)
  //         // reset correlation so that it sits at the beginning of the extrapolation window from the end time
  //         this._localEndTimeCorrelation = {
  //           local: this._now,
  //           remote: (endTime - this._extrapolatedWindowDuration) * 1000
  //         };
  //       } else if (extrapolatedEndTime > previousEndTime) {
  //         // end time was past the old end time (so would have been capped)
  //         // set the correlation so that it resumes from the time it was at at the end of the old window
  //         this._localEndTimeCorrelation = {
  //           local: this._now,
  //           remote: previousEndTime * 1000
  //         };
  //       }
  //     }
  //   }

  //   // now that the values have been updated call any methods that use on them so they get the updated values
  //   // immediately
  //   durationChanged && this._onDurationChange();
  //   startTimeChanged && this._onProgress();
  // }

  // _onFragmentLoaded(evt, data) {
  //   this.trigger(Events.PLAYBACK_FRAGMENT_LOADED, data);
  // }

  private onLevelSwitch(currentLevel: BitrateInfo) {
    this.trigger(Events.PLAYBACK_BITRATE, {
      height: currentLevel.height,
      width: currentLevel.width,
      bitrate: currentLevel.bitrate,
      level: currentLevel.qualityIndex
    });
  }

  getPlaybackType() {
    return this._playbackType;
  }

  isSeekEnabled() {
    return (this._playbackType === Playback.VOD || this.dvrEnabled);
  }
}

DashPlayback.canPlay = function (resource, mimeType) {
  const resourceParts = resource.split('?')[0].match(/.*\.(.*)$/) || [];
  const isDash = ((resourceParts.length > 1 && resourceParts[1].toLowerCase() === 'mpd') ||
    mimeType === 'application/dash+xml' || mimeType === 'video/mp4');
  const ctor = window.MediaSource || ('WebKitMediaSource' in window ? window.WebKitMediaSource : undefined);
  const hasBrowserSupport = typeof ctor === 'function';
  Log.debug(T, 'canPlay', {hasBrowserSupport, isDash});
  return !!(hasBrowserSupport && isDash);
};
