import { Container, ContainerPlugin, Events, Log } from '@clappr/core';
import { TimePosition } from '@gcorevideo/player';
import assert from 'assert';
import get from 'lodash.get';

import { CLAPPR_VERSION } from '../build.js';
import { QualityLevelInfo, TimerId } from '../types.js';

type TimeProgressValue = TimePosition & {
  start: number;
}

export type Metrics = {
  counters: {
    play: number;
    pause: number;
    error: number;
    buffering: number;
    decodedFrames: number;
    droppedFrames: number;
    fps: number;
    changeLevel: number;
    seek: number;
    fullscreen: number;
    dvrUsage: number;
  };
  timers: {
    startup: number;
    watch: number;
    pause: number;
    buffering: number;
    session: number;
    latency: number;
  };
  extra: {
    playbackName: string;
    playbackType: string;
    bitratesHistory: BitrateHistoryRecord[];
    bitrateWeightedMean: number;
    bitrateMostUsed: number;
    buffersize: number;
    watchHistory: Array<[number, number]>;
    watchedPercentage: number;
    bufferingPercentage: number;
    bandwidth: number;
    duration: number;
    currentTime: number;
  };
  custom: Record<string, unknown>;
};

type BitrateHistoryRecord = {
  start: number;
  end?: number;
  time?: number;
  bitrate: number;
}

export type MetricsUpdateFn = (metrics: Metrics) => void;

type StatsTimer = keyof Metrics['timers'];

type UriToMeasureBandwidth = {
  url: string;
  start: number;
  end: number;
  expired: boolean;
  timeout: number;
  timer: TimerId | null;
}

// type XMLHttpRequestEvent = {
//   loaded: number;
// }

enum ClapprStatsEvents {
  REPORT_EVENT = 'clappr:stats:report',
  PERCENTAGE_EVENT = 'clappr:stats:percentage',
}

function newMetrics(): Metrics {
  return {
    counters: {
      play: 0,
      pause: 0,
      error: 0,
      buffering: 0,
      decodedFrames: 0,
      droppedFrames: 0,
      fps: 0,
      changeLevel: 0,
      seek: 0,
      fullscreen: 0,
      dvrUsage: 0,
    },
    timers: {
      startup: 0,
      watch: 0,
      pause: 0,
      buffering: 0,
      session: 0,
      latency: 0,
    },
    extra: {
      playbackName: '',
      playbackType: '',
      bitratesHistory: [],
      bitrateWeightedMean: 0,
      bitrateMostUsed: 0,
      buffersize: 0,
      watchHistory: [],
      watchedPercentage: 0,
      bufferingPercentage: 0,
      bandwidth: 0,
      duration: 0,
      currentTime: 0,
    },
    custom: {},
  };
}

// TODO: fix
const updateMetrics = () => {};

export class ClapprStats extends ContainerPlugin {
  private _bwMeasureCount = 0;

  private _intervalId: TimerId | null = null;
  
  private _lastDecodedFramesCount = 0;

  private _metrics: Metrics = newMetrics();

  private _completion: {
    watch: number[];
    calls: number[];
  };

  private _onReport: (metrics: Metrics) => void;

  private _runBandwidthTestEvery: number;

  private _runEach: number;

  private _timers: Record<StatsTimer, number> = {
    startup: 0,
    watch: 0,
    pause: 0,
    buffering: 0,
    session: 0,
    latency: 0,
  };

  private _updateMetrics: MetricsUpdateFn = updateMetrics;

  private _urisToMeasureBandwidth: UriToMeasureBandwidth[];

  private _uriToMeasureLatency: string | undefined;

  get name() {
    return 'clappr_stats';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  get _playbackName() {
    return String(this.container.playback.name || '');
  }

  get _playbackType() {
    return this.container.getPlaybackType();
  }

  private _now() {
    const hasPerformanceSupport = window.performance && typeof (window.performance.now) === 'function';

    return (hasPerformanceSupport) ? window.performance.now() : new Date().getTime();
  }

  private _inc(counter: keyof Metrics['counters']) {
    this._metrics.counters[counter] += 1;
  }

  // _timerHasStarted(timer) {
  //   return this[`_start${timer}`] !== undefined;
  // }

  private _start(timer: StatsTimer) {
    // this[`_start${timer}`] = this._now();
    this._timers[timer] = this._now();
  }

  private _stop(timer: StatsTimer) {
    // this._metrics.timers[timer] += this._now() - this[`_start${timer}`];
    this._metrics.timers[timer] += this._now() - this._timers[timer];
  }

  setUpdateMetrics(updateMetricsFn: MetricsUpdateFn) {
    this._updateMetrics = updateMetricsFn;
  }

  _defaultReport(metrics: Metrics) {
    this._updateMetrics(metrics);
  }

  constructor(container: Container) {
    super(container);
    this._runEach = get(container, 'options.clapprStats.runEach', 5000);
    this._onReport = get(container, 'options.clapprStats.onReport', this._defaultReport);
    this._uriToMeasureLatency = get(container, 'options.clapprStats.uriToMeasureLatency');
    this._urisToMeasureBandwidth = get(container, 'options.clapprStats.urisToMeasureBandwidth');
    this._runBandwidthTestEvery = get(container, 'options.clapprStats.runBandwidthTestEvery', 10);

    this._completion = {
      watch: get(container, 'options.clapprStats.onCompletion', []),
      calls: []
    };
  }

  bindEvents() {
    this.listenTo(this.container, Events.CONTAINER_BITRATE, this.onBitrate);
    this.listenTo(this.container, Events.CONTAINER_STOP, this.stopReporting);
    this.listenTo(this.container, Events.CONTAINER_ENDED, this.stopReporting);
    this.listenToOnce(this.container.playback, Events.PLAYBACK_PLAY_INTENT, this.startTimers);
    this.listenToOnce(this.container, Events.CONTAINER_PLAY, this.onFirstPlaying);
    this.listenTo(this.container, Events.CONTAINER_PLAY, this.onPlay);
    this.listenTo(this.container, Events.CONTAINER_PAUSE, this.onPause);
    this.listenToOnce(this.container, Events.CONTAINER_STATE_BUFFERING, this.onBuffering);
    this.listenTo(this.container, Events.CONTAINER_SEEK, this.onSeek);
    this.listenTo(this.container, Events.CONTAINER_ERROR, () => this._inc('error'));
    this.listenTo(this.container, Events.CONTAINER_FULLSCREEN, () => this._inc('fullscreen'));
    this.listenTo(this.container, Events.CONTAINER_PLAYBACKDVRSTATECHANGED, (dvrInUse: boolean) => {
      dvrInUse && this._inc('dvrUsage');
    });
    this.listenTo(this.container.playback, Events.PLAYBACK_PROGRESS, this.onProgress);
    this.listenTo(this.container.playback, Events.PLAYBACK_TIMEUPDATE, this.onTimeUpdate);
  }

  destroy() {
    this.stopReporting();
    super.destroy();
  }

  onBitrate(newBitrate: QualityLevelInfo) {
    const bitrate = newBitrate.bitrate;
    const now = this._now();

    if (this._metrics.extra.bitratesHistory.length > 0) {
      const beforeLast = this._metrics.extra.bitratesHistory[this._metrics.extra.bitratesHistory.length - 1];

      beforeLast.end = now;
      beforeLast.time = now - beforeLast.start;
    }

    this._metrics.extra.bitratesHistory.push({ start: this._now(), bitrate: bitrate });

    this._inc('changeLevel');
  }

  stopReporting() {
    this._buildReport();

    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._newMetrics();

    // @ts-ignore
    this.stopListening();
    this.bindEvents();
  }

  startTimers() {
    this._intervalId = setInterval(this._buildReport.bind(this), this._runEach);
    this._start('session');
    this._start('startup');
  }

  onFirstPlaying() {
    this.listenTo(this.container, Events.CONTAINER_TIMEUPDATE, this.onContainerUpdateWhilePlaying);

    this._start('watch');
    this._stop('startup');
  }

  playAfterPause() {
    this.listenTo(this.container, Events.CONTAINER_TIMEUPDATE, this.onContainerUpdateWhilePlaying);
    this._stop('pause');
    this._start('watch');
  }

  private onPlay() {
    this._inc('play');
  }

  private onPause() {
    this._stop('watch');
    this._start('pause');
    this._inc('pause');
    this.listenToOnce(this.container, Events.CONTAINER_PLAY, this.playAfterPause);
    this.stopListening(this.container, Events.CONTAINER_TIMEUPDATE, this.onContainerUpdateWhilePlaying);
  }

  private onSeek(e: number) {
    this._inc('seek');
    this._metrics.extra.watchHistory.push([e * 1000, e * 1000]);
  }

  private onTimeUpdate(e: TimePosition) {
    const current = e.current * 1000,
      total = e.total * 1000,
      l = this._metrics.extra.watchHistory.length;

    this._metrics.extra.duration = total;
    this._metrics.extra.currentTime = current;
    this._metrics.extra.watchedPercentage = (current / total) * 100;

    if (l === 0) {
      this._metrics.extra.watchHistory.push([current, current]);
    } else {
      this._metrics.extra.watchHistory[l - 1][1] = current;
    }

    if (this._metrics.extra.bitratesHistory.length > 0) {
      const lastBitrate = this._metrics.extra.bitratesHistory[this._metrics.extra.bitratesHistory.length - 1];

      if (!lastBitrate.end) {
        lastBitrate.time = this._now() - lastBitrate.start;
      }
    }

    this._onCompletion();
  }

  private onContainerUpdateWhilePlaying() {
    if (this.container.playback.isPlaying()) {
      this._stop('watch');
      this._start('watch');
    }
  }

  private onBuffering() {
    this._inc('buffering');
    this._start('buffering');
    this.listenToOnce(this.container, Events.CONTAINER_STATE_BUFFERFULL, this.onBufferfull);
  }

  private onBufferfull() {
    this._stop('buffering');
    this.listenToOnce(this.container, Events.CONTAINER_STATE_BUFFERING, this.onBuffering);
  }

  private onProgress(progress: TimeProgressValue) {
    this._metrics.extra.buffersize = progress.current * 1000;
  }

  private _newMetrics() {
    this._metrics = newMetrics();
  }

  private _onCompletion() {
    const currentPercentage = this._metrics.extra.watchedPercentage;
    const allPercentages = this._completion.watch;
    const isCalled = this._completion.calls.indexOf(currentPercentage) !== -1;

    if (allPercentages.indexOf(currentPercentage) !== -1 && !isCalled) {
      Log.info(this.name + ' PERCENTAGE_EVENT: ' + currentPercentage);
      this._completion.calls.push(currentPercentage);
      this.trigger(ClapprStatsEvents.PERCENTAGE_EVENT, currentPercentage);
    }
  }

  _buildReport() {
    this._stop('session');
    this._start('session');

    this._metrics.extra.playbackName = this._playbackName;
    this._metrics.extra.playbackType = this._playbackType;

    this._calculateBitrates();
    this._calculatePercentages();
    this._fetchFPS();
    this._measureLatency();
    this._measureBandwidth();

    this._onReport(this._metrics);
    this.trigger(ClapprStatsEvents.REPORT_EVENT, JSON.parse(JSON.stringify(this._metrics)));
  }

  private _fetchFPS() {
    // flashls ??? - hls.droppedFramesl hls.stream.bufferLength (seconds)
    // hls ??? (use the same?)
    const fetchFPS = {
      'html5_video': this._html5FetchFPS,
      'hls': this._html5FetchFPS,
      'dash_shaka_playback': this._html5FetchFPS
    };

    if (this._playbackName in fetchFPS) {
      fetchFPS[this._playbackName as keyof typeof fetchFPS].call(this);
    }
  }

  private _calculateBitrates() {
    const { bitratesHistory } = this._metrics.extra;

    if (bitratesHistory.length === 0) {
      return;
    }

    let totalTime = 0;
    let weightedTotal = 0;

    for (const { bitrate, time = 0 } of bitratesHistory) {
      totalTime += time;
      weightedTotal += bitrate * time;
    }
    this._metrics.extra.bitrateWeightedMean = weightedTotal / totalTime;

    this._metrics.extra.bitrateMostUsed = bitratesHistory.reduce((mostUsed, current) =>
      (current.time || 0) > (mostUsed.time || 0) ? current : mostUsed,
      { time: 0, bitrate: 0, start: 0, end: 0 },
    ).bitrate;
  }

  private _calculatePercentages() {
    if (this._metrics.extra.duration > 0) {
      this._metrics.extra.bufferingPercentage = (this._metrics.timers.buffering / this._metrics.extra.duration) * 100;
    }
  }

  private _html5FetchFPS() {
    const videoTag = this.container.playback.el;

    const getFirstValidValue = (...args: any[]) => args.find(val => val !== undefined);

    const decodedFrames = getFirstValidValue(videoTag.webkitDecodedFrameCount, videoTag.mozDecodedFrames, 0);
    const droppedFrames = getFirstValidValue(
      videoTag.webkitDroppedFrameCount,
      videoTag.mozParsedFrames && videoTag.mozDecodedFrames ? videoTag.mozParsedFrames - videoTag.mozDecodedFrames : 0,
      0
    );
    const decodedFramesLastTime = decodedFrames - (this._lastDecodedFramesCount || 0);

    this._metrics.counters.decodedFrames = decodedFrames;
    this._metrics.counters.droppedFrames = droppedFrames;
    this._metrics.counters.fps = decodedFramesLastTime / (this._runEach / 1000);

    this._lastDecodedFramesCount = decodedFrames;
  }

  // originally from https://www.smashingmagazine.com/2011/11/analyzing-network-characteristics-using-javascript-and-the-dom-part-1/
  private _measureLatency() {
    if (this._uriToMeasureLatency) {
      const t: number[] = [];
      const n = 2;
      let rtt;
      const ld = () => {
        t.push(this._now());
        if (t.length > n) {
          done();
        } else {
          const img = new Image;

          img.onload = ld;
          img.src = this._uriToMeasureLatency + '?' + Math.random()
            + '=' + this._now();
        }
      };
      const done = () => {
        rtt = t[2] - t[1];
        this._metrics.timers.latency = rtt;
      };

      ld();
    }
  }

  // originally from https://www.smashingmagazine.com/2011/11/analyzing-network-characteristics-using-javascript-and-the-dom-part-1/
  private _measureBandwidth() {
    if (this._urisToMeasureBandwidth && (this._bwMeasureCount % this._runBandwidthTestEvery === 0)) {
      let i = 0;

      const ld = (e?: ProgressEvent) => {
        if (i > 0) {
          const prev = this._urisToMeasureBandwidth[i - 1];
          prev.end = this._now();
          if (prev.timer !== null) {
            clearTimeout(prev.timer);
          }
        }
        if (i >= this._urisToMeasureBandwidth.length || (i > 0 && this._urisToMeasureBandwidth[i - 1].expired)) {
          assert(e, 'incorrect invocation in _measureBandwidth');
          done(e);
        } else {
          const xhr = new XMLHttpRequest();

          xhr.open('GET', this._urisToMeasureBandwidth[i].url, true);
          xhr.responseType = 'arraybuffer';
          xhr.onload = xhr.onabort = ld;
          this._urisToMeasureBandwidth[i].start = this._now();
          this._urisToMeasureBandwidth[i].timer = setTimeout((j) => {
            this._urisToMeasureBandwidth[j].expired = true;
            xhr.abort();
          }, this._urisToMeasureBandwidth[i].timeout, i);
          xhr.send();
        }
        i++;
      };

      const done = (e: ProgressEvent) => {
        const timeSpent = (this._urisToMeasureBandwidth[i - 1].end - this._urisToMeasureBandwidth[i - 1].start) / 1000;
        const bandwidthBps = (e.loaded * 8) / timeSpent;

        this._metrics.extra.bandwidth = bandwidthBps;
        this._urisToMeasureBandwidth.forEach((x) => {
          x.start = 0;
          x.end = 0;
          x.expired = false;
          if (x.timer !== null) {
            clearTimeout(x.timer);
            x.timer = null;
          }
        });
      };

      ld();
    }
    this._bwMeasureCount++;
  }
}

// ClapprStats.REPORT_EVENT = 'clappr:stats:report';
// ClapprStats.PERCENTAGE_EVENT = 'clappr:stats:percentage';
