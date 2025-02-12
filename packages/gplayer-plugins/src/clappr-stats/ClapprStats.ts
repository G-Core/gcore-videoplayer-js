import { Container, ContainerPlugin, Events as CoreEvents, Log } from '@clappr/core';
import type { QualityLevel, TimePosition, TimeProgress } from '@gcorevideo/player';
import assert from 'assert';

import { CLAPPR_VERSION } from '../build.js';
import { TimerId } from '../types.js';
import type { Metrics, MetricsUpdateFn } from './types.js';
import { ClapprStatsEvents } from './types.js';
import { newMetrics } from './utils.js';

type StatsTimer = keyof Metrics['timers'];

type UriToMeasureBandwidth = {
  url: string;
  start: number;
  end: number;
  expired: boolean;
  timeout: number;
  timer: TimerId | null;
}

// TODO: fix
const updateMetrics = () => {};

export class ClapprStats extends ContainerPlugin {
  private bwMeasureCount = 0;

  private intervalId: TimerId | null = null;
  
  private lastDecodedFramesCount = 0;

  private metrics: Metrics = newMetrics();

  private completion: {
    watch: number[];
    calls: number[];
  };

  private _onReport: (metrics: Metrics) => void;

  private runBandwidthTestEvery: number;

  private runEach: number;

  private timers: Record<StatsTimer, number> = {
    startup: 0,
    watch: 0,
    pause: 0,
    buffering: 0,
    session: 0,
    latency: 0,
  };

  private updateFn: MetricsUpdateFn = updateMetrics;

  private urisToMeasureBandwidth: UriToMeasureBandwidth[];

  private uriToMeasureLatency: string | undefined;

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
    this.metrics.counters[counter] += 1;
  }

  // _timerHasStarted(timer) {
  //   return this[`_start${timer}`] !== undefined;
  // }

  private start(timer: StatsTimer) {
    // this[`_start${timer}`] = this._now();
    this.timers[timer] = this._now();
  }

  private _stop(timer: StatsTimer) {
    // this._metrics.timers[timer] += this._now() - this[`_start${timer}`];
    this.metrics.timers[timer] += this._now() - this.timers[timer];
  }

  setUpdateMetrics(updateMetricsFn: MetricsUpdateFn) {
    this.updateFn = updateMetricsFn;
  }

  _defaultReport(metrics: Metrics) {
    this.updateFn(metrics);
  }

  constructor(container: Container) {
    super(container);
    this.runEach = container.options.clapprStats?.runEach ?? 5000;
    this._onReport = container.options.clapprStats?.onReport ?? this._defaultReport;
    this.uriToMeasureLatency = container.options.clapprStats?.uriToMeasureLatency;
    this.urisToMeasureBandwidth = container.options.clapprStats?.urisToMeasureBandwidth;
    this.runBandwidthTestEvery = container.options.clapprStats?.runBandwidthTestEvery ?? 10;

    this.completion = {
      watch: container.options.clapprStats?.onCompletion ?? [],
      calls: []
    };
  }

  override bindEvents() {
    this.listenTo(this.container, CoreEvents.CONTAINER_BITRATE, this.onBitrate);
    this.listenTo(this.container, CoreEvents.CONTAINER_STOP, this.stopReporting);
    this.listenTo(this.container, CoreEvents.CONTAINER_ENDED, this.stopReporting);
    this.listenToOnce(this.container.playback, CoreEvents.PLAYBACK_PLAY_INTENT, this.startTimers);
    this.listenToOnce(this.container, CoreEvents.CONTAINER_PLAY, this.onFirstPlaying);
    this.listenTo(this.container, CoreEvents.CONTAINER_PLAY, this.onPlay);
    this.listenTo(this.container, CoreEvents.CONTAINER_PAUSE, this.onPause);
    this.listenToOnce(this.container, CoreEvents.CONTAINER_STATE_BUFFERING, this.onBuffering);
    this.listenTo(this.container, CoreEvents.CONTAINER_SEEK, this.onSeek);
    this.listenTo(this.container, CoreEvents.CONTAINER_ERROR, () => this._inc('error'));
    this.listenTo(this.container, CoreEvents.CONTAINER_FULLSCREEN, () => this._inc('fullscreen'));
    this.listenTo(this.container, CoreEvents.CONTAINER_PLAYBACKDVRSTATECHANGED, (dvrInUse: boolean) => {
      dvrInUse && this._inc('dvrUsage');
    });
    this.listenTo(this.container.playback, CoreEvents.PLAYBACK_PROGRESS, this.onProgress);
    this.listenTo(this.container.playback, CoreEvents.PLAYBACK_TIMEUPDATE, this.onTimeUpdate);
  }

  override destroy() {
    this.stopReporting();
    super.destroy();
  }

  exportMetrics() {
    return structuredClone(this.metrics);
  }

  onBitrate(newBitrate: QualityLevel) {
    const bitrate = newBitrate.bitrate;
    const now = this._now();

    if (this.metrics.extra.bitratesHistory.length > 0) {
      const beforeLast = this.metrics.extra.bitratesHistory[this.metrics.extra.bitratesHistory.length - 1];

      beforeLast.end = now;
      beforeLast.time = now - beforeLast.start;
    }

    this.metrics.extra.bitratesHistory.push({ start: this._now(), bitrate: bitrate });

    this._inc('changeLevel');
  }

  stopReporting() {
    this._buildReport();

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._newMetrics();

    // @ts-ignore
    this.stopListening();
    this.bindEvents();
  }

  startTimers() {
    this.intervalId = setInterval(this._buildReport.bind(this), this.runEach);
    this.start('session');
    this.start('startup');
  }

  onFirstPlaying() {
    this.listenTo(this.container, CoreEvents.CONTAINER_TIMEUPDATE, this.onContainerUpdateWhilePlaying);

    this.start('watch');
    this._stop('startup');
  }

  playAfterPause() {
    this.listenTo(this.container, CoreEvents.CONTAINER_TIMEUPDATE, this.onContainerUpdateWhilePlaying);
    this._stop('pause');
    this.start('watch');
  }

  private onPlay() {
    this._inc('play');
  }

  private onPause() {
    this._stop('watch');
    this.start('pause');
    this._inc('pause');
    this.listenToOnce(this.container, CoreEvents.CONTAINER_PLAY, this.playAfterPause);
    this.stopListening(this.container, CoreEvents.CONTAINER_TIMEUPDATE, this.onContainerUpdateWhilePlaying);
  }

  private onSeek(e: number) {
    this._inc('seek');
    this.metrics.extra.watchHistory.push([e * 1000, e * 1000]);
  }

  private onTimeUpdate(e: TimePosition) {
    const current = e.current * 1000,
      total = e.total * 1000,
      l = this.metrics.extra.watchHistory.length;

    this.metrics.extra.duration = total;
    this.metrics.extra.currentTime = current;
    this.metrics.extra.watchedPercentage = (current / total) * 100;

    if (l === 0) {
      this.metrics.extra.watchHistory.push([current, current]);
    } else {
      this.metrics.extra.watchHistory[l - 1][1] = current;
    }

    if (this.metrics.extra.bitratesHistory.length > 0) {
      const lastBitrate = this.metrics.extra.bitratesHistory[this.metrics.extra.bitratesHistory.length - 1];

      if (!lastBitrate.end) {
        lastBitrate.time = this._now() - lastBitrate.start;
      }
    }

    this._onCompletion();
  }

  private onContainerUpdateWhilePlaying() {
    if (this.container.playback.isPlaying()) {
      this._stop('watch');
      this.start('watch');
    }
  }

  private onBuffering() {
    this._inc('buffering');
    this.start('buffering');
    this.listenToOnce(this.container, CoreEvents.CONTAINER_STATE_BUFFERFULL, this.onBufferfull);
  }

  private onBufferfull() {
    this._stop('buffering');
    this.listenToOnce(this.container, CoreEvents.CONTAINER_STATE_BUFFERING, this.onBuffering);
  }

  private onProgress(progress: TimeProgress) {
    this.metrics.extra.buffersize = progress.current * 1000;
  }

  private _newMetrics() {
    this.metrics = newMetrics();
  }

  private _onCompletion() {
    const currentPercentage = this.metrics.extra.watchedPercentage;
    const allPercentages = this.completion.watch;
    const isCalled = this.completion.calls.indexOf(currentPercentage) !== -1;

    if (allPercentages.indexOf(currentPercentage) !== -1 && !isCalled) {
      Log.info(this.name + ' PERCENTAGE_EVENT: ' + currentPercentage);
      this.completion.calls.push(currentPercentage);
      this.trigger(ClapprStatsEvents.PERCENTAGE_EVENT, currentPercentage);
    }
  }

  _buildReport() {
    this._stop('session');
    this.start('session');

    this.metrics.extra.playbackName = this._playbackName;
    this.metrics.extra.playbackType = this._playbackType;

    this._calculateBitrates();
    this._calculatePercentages();
    this._fetchFPS();
    this._measureLatency();
    this._measureBandwidth();

    this._onReport(this.metrics);
    this.trigger(ClapprStatsEvents.REPORT_EVENT, structuredClone(this.metrics));
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
    const { bitratesHistory } = this.metrics.extra;

    if (bitratesHistory.length === 0) {
      return;
    }

    let totalTime = 0;
    let weightedTotal = 0;

    for (const { bitrate, time = 0 } of bitratesHistory) {
      totalTime += time;
      weightedTotal += bitrate * time;
    }
    this.metrics.extra.bitrateWeightedMean = weightedTotal / totalTime;

    this.metrics.extra.bitrateMostUsed = bitratesHistory.reduce((mostUsed, current) =>
      (current.time || 0) > (mostUsed.time || 0) ? current : mostUsed,
      { time: 0, bitrate: 0, start: 0, end: 0 },
    ).bitrate;
  }

  private _calculatePercentages() {
    if (this.metrics.extra.duration > 0) {
      this.metrics.extra.bufferingPercentage = (this.metrics.timers.buffering / this.metrics.extra.duration) * 100;
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
    const decodedFramesLastTime = decodedFrames - (this.lastDecodedFramesCount || 0);

    this.metrics.counters.decodedFrames = decodedFrames;
    this.metrics.counters.droppedFrames = droppedFrames;
    this.metrics.counters.fps = decodedFramesLastTime / (this.runEach / 1000);

    this.lastDecodedFramesCount = decodedFrames;
  }

  // originally from https://www.smashingmagazine.com/2011/11/analyzing-network-characteristics-using-javascript-and-the-dom-part-1/
  private _measureLatency() {
    if (this.uriToMeasureLatency) {
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
          img.src = this.uriToMeasureLatency + '?' + Math.random()
            + '=' + this._now();
        }
      };
      const done = () => {
        rtt = t[2] - t[1];
        this.metrics.timers.latency = rtt;
      };

      ld();
    }
  }

  // originally from https://www.smashingmagazine.com/2011/11/analyzing-network-characteristics-using-javascript-and-the-dom-part-1/
  private _measureBandwidth() {
    if (this.urisToMeasureBandwidth && (this.bwMeasureCount % this.runBandwidthTestEvery === 0)) {
      let i = 0;

      const ld = (e?: ProgressEvent) => {
        if (i > 0) {
          const prev = this.urisToMeasureBandwidth[i - 1];
          prev.end = this._now();
          if (prev.timer !== null) {
            clearTimeout(prev.timer);
          }
        }
        if (i >= this.urisToMeasureBandwidth.length || (i > 0 && this.urisToMeasureBandwidth[i - 1].expired)) {
          assert(e, 'incorrect invocation in _measureBandwidth');
          done(e);
        } else {
          const xhr = new XMLHttpRequest();

          xhr.open('GET', this.urisToMeasureBandwidth[i].url, true);
          xhr.responseType = 'arraybuffer';
          xhr.onload = xhr.onabort = ld;
          this.urisToMeasureBandwidth[i].start = this._now();
          this.urisToMeasureBandwidth[i].timer = setTimeout((j) => {
            this.urisToMeasureBandwidth[j].expired = true;
            xhr.abort();
          }, this.urisToMeasureBandwidth[i].timeout, i);
          xhr.send();
        }
        i++;
      };

      const done = (e: ProgressEvent) => {
        const timeSpent = (this.urisToMeasureBandwidth[i - 1].end - this.urisToMeasureBandwidth[i - 1].start) / 1000;
        const bandwidthBps = (e.loaded * 8) / timeSpent;

        this.metrics.extra.bandwidth = bandwidthBps;
        this.urisToMeasureBandwidth.forEach((x) => {
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
    this.bwMeasureCount++;
  }
}

// ClapprStats.REPORT_EVENT = 'clappr:stats:report';
// ClapprStats.PERCENTAGE_EVENT = 'clappr:stats:percentage';
