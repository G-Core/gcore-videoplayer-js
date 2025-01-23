import { Browser, Container, ContainerPlugin, Events, Playback } from '@clappr/core';
import { StreamMediaSource, type TimePosition } from '@gcorevideo/player';
import Fingerprint from '@fingerprintjs/fingerprintjs';
import { Events as HlsEvents, FragChangedData } from 'hls.js';

import { CLAPPR_VERSION } from '../build.js';

export class Statistics extends ContainerPlugin {
  get name() {
    return 'statistics_gplayer';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  private socketOpen = false;

  private init = false;

  private started = false;

  private played = false;

  private playerReady = false;

  private prevTimeCurrent = 0;

  private firstHeatmapSent = false;

  private isLiveWatchSent = false;

  private countBufferAvailable = false;

  private startTimeRepeatableRoll = 0;

  private heatmapCounter = 1;

  private lags = 0;

  private bufferStartTime = 0;

  private bufferComputeTime = 0;

  private url = '';

  private uuid = '';

  private socket: WebSocket | null = null;

  private startTime = 0;

  private streamID = 0;

  constructor(container: Container) {
    super(container);
    this.connect();
  }

  override bindEvents() {
    this.listenToOnce(this.container.playback, Events.PLAYBACK_PLAY, this.onPlay);
    this.listenToOnce(this.container, 'container:start', this.onStart);

    this.listenToOnce(this.container, Events.CONTAINER_READY, this.onReady);
    this.listenTo(this.container, Events.CONTAINER_STATE_BUFFERING, this.onBuffering);
    this.listenTo(this.container, Events.CONTAINER_STATE_BUFFERFULL, this.onBufferFull);
    this.listenTo(this.container.playback, Events.PLAYBACK_TIMEUPDATE, this.onTimeUpdate);
    this.listenTo(this.container.playback, Events.PLAYBACK_TIMEUPDATE, this.onTimeUpdateLive);
    this.listenTo(this.container.playback, Events.PLAYBACK_LEVEL_SWITCH_START, this.startLevelSwitch);
    this.listenTo(this.container.playback, Events.PLAYBACK_LEVEL_SWITCH_END, this.stopLevelSwitch);
  }

  private startLevelSwitch() {
    this.countBufferAvailable = false;
  }

  private stopLevelSwitch() {
    this.countBufferAvailable = true;
  }

  private onBuffering() {
    if (this.countBufferAvailable) {
      this.bufferStartTime = performance.now();
    }
  }

  private onBufferFull() {
    if (this.countBufferAvailable && this.bufferStartTime) {
      this.bufferComputeTime += Math.round(performance.now() - this.bufferStartTime);
      this.lags++;
    }
    this.countBufferAvailable = true;
  }

  private connect() {
    try {
      if (!this.options.statistics.url) {
        return;
      }
    } catch (error) {
      reportError(error);

      return;
    }
    this.removeSocket();
    this.url = this.options.statistics.url;

    try {
      this.socket = new WebSocket(this.url);
      this.socket.onopen = this.openHandler;
      this.socket.onclose = this.closeHandler;
      this.socket.onerror = this.errorHandler;
    } catch (error) {
      reportError(error);
    }
  }

  private openHandler = () => {
    this.socketOpen = true;
    if (this.playerReady && !this.init) {
      this.initEvent();
    }
  }

  private closeHandler = () => {}

  private errorHandler = () => {}

  private removeSocket() {
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }
  }

  private onReady() {
    this.playerReady = true;
    const element = this.findElementBySource(this.options.source);

    if (!element) {
      this.destroy();

      return;
    }
    Fingerprint.load()
      .then(agent => agent.get())
      .then((res) => {
        this.uuid = res.visitorId;
      });

    this.streamID = element.id;

    if (this.socketOpen && !this.init) {
      this.initEvent();
    }
  }

  private findElementBySource(source: string): StreamMediaSource | undefined {
    return this.options.multisources.find((s: StreamMediaSource) => s.source === source);
  }

  private initEvent() {
    this.init = true;
    this.sendMessage('init');
    if (this.options.autoPlay) {
      this.container.trigger('container:start');
    }
  }

  private sendMessage(state: 'init' | 'start' | 'watch') {
    this.send(JSON.stringify({
      event: state,
      type: this.container.getPlaybackType(),
      embed_url: this.options.referer,
      user_agent: Browser.userAgent
    }));
  }

  private send(str: string) {
    if (this.socket) {
      this.socket.send(str);
    }
  }

  private onTimeUpdateLive() {
    if (!this.streamID) {
      return;
    }

    let currentTime = 0;

    try {
      let startTime = this.startTimeRepeatableRoll;

      if (!this.startTimeRepeatableRoll) {
        if (!startTime) {
          this.startTimeRepeatableRoll = startTime = this.container.playback.el.currentTime;
        }
      }

      currentTime = this.container.playback.el.currentTime - startTime;
      this.played = true;

      if (this.started && this.played && !this.firstHeatmapSent && Math.floor(currentTime) === 0) {
        this.firstHeatmapSent = true;
        this.sendHeatmap();
      }

      if (currentTime > 0 && Math.floor(currentTime / 10) === 1 && this.uuid) {
        this.sendHeatmap();
      }

      if (this.container.getPlaybackType() === Playback.LIVE && !this.isLiveWatchSent && currentTime >= 5) {
        this.isLiveWatchSent = true;
        this.sendMessage('watch');
      }
    } catch (error) {
      reportError(error);
    }
  }

  private sendHeatmap() {
    this.startTimeRepeatableRoll = this.container.playback.el.currentTime;
    const res: Record<string, unknown> = {
      'event': 'heatmap',
      'uniq_id': this.uuid,
      'type': this.container.getPlaybackType(),
      'stream_id': this.streamID,
      lags: this.lags,
      buffering: this.bufferComputeTime,
    };

    this.bufferComputeTime = 0;
    this.lags = 0;
    if (this.container.getPlaybackType() === Playback.VOD) {
      res.timestamp = this.container.playback.el.currentTime;
    }
    this.send(JSON.stringify(res));
  }

  private onTimeUpdate({ current }: TimePosition) {
    if (this.container.getPlaybackType() === Playback.LIVE) {
      this.stopListening(this.container.playback, Events.PLAYBACK_TIMEUPDATE, this.onTimeUpdate);

      return;
    }

    if (!this.prevTimeCurrent) {
      this.prevTimeCurrent = current;
    }

    if (Math.abs(this.prevTimeCurrent - current) > 5 && this.socketOpen) {
      this.stopListening(this.container.playback, Events.PLAYBACK_TIMEUPDATE, this.onTimeUpdate);
      this.sendMessage('watch');
    }
  }

  private onStart() {
    this.sendMessage('start');
    this.started = true;
    if (this.started && this.played && !this.firstHeatmapSent) {
      this.firstHeatmapSent = true;
      this.sendHeatmap();
    }
  }

  private onPlay() {
    try {
      if (this.container.playback._hls) {
        this.container.playback._hls.on(HlsEvents.FRAG_CHANGED, (_: HlsEvents.FRAG_CHANGED, b: FragChangedData) => {
          if (this.options.debug === 'hls') {
            console.warn(b.frag);
          }
        });
      }
    } catch (error) {
      reportError(error);
    }
    if (this.startTime) {
      return;
    }

    this.startTime = new Date().getTime();
  }
}
