import {
  Browser,
  Log,
  Player as PlayerClappr,
  $,
  Loader,
} from '@clappr/core';
import assert from 'assert';
import Hls from 'hls.js';
import EventLite from "event-lite";

import '../assets/style/main.scss'; // TODO check if needed

import type {
  CorePlayerEvents,
  CoreOptions,
  CorePluginOptions,
  PlayerMediaSource,
} from "./internal.types.js";
import type {
  PlayerPlugin,
  StreamMediaSource,
} from "./types";

import { reportError, trace } from "./trace/index.js";
import {
  PlayerConfig,
  MediaTransport,
  TransportPreference,
} from "./types.js";

export enum PlayerEvent {
  Ready = 'ready',
  Play = 'play',
  Pause = 'pause',
  Stop = 'stop',
  Ended = 'ended',
}

// TODO implement transport retry/failover and fallback logic

type PlayerEventHandler<T extends PlayerEvent> = () => void;

const T = "Player";

const DEFAULT_OPTIONS: Partial<PlayerConfig> = {
  autoPlay: false,
  mute: false,
  loop: false,
}

type PluginOptions = Record<string, unknown>;

/**
 * @beta
 */
export class Player {
  private emitter = new EventLite();

  private player: PlayerClappr | null = null;

  private pluginLoaders: Array<() => Promise<void>> = [];

  private clapprReady = false;

  private timer: ReturnType<typeof setTimeout> | null = null;

  private tuneInEntered = false;

  private supportedMediaTransports: MediaTransport[] = [];

  private config: PlayerConfig;

  get playing() {
    return this.player ? this.player.isPlaying() : false;
  }

  get ready() {
    return this.clapprReady;
  }

  constructor(
    config: PlayerConfig,
  ) {
    this.config = $.extend(true, {}, DEFAULT_OPTIONS, config);
  }

  on<T extends PlayerEvent>(event: T, handler: PlayerEventHandler<T>) {
    this.emitter.on(event, handler);
  }

  off<T extends PlayerEvent>(event: T, handler: PlayerEventHandler<T>) {
    this.emitter.off(event, handler);
  }

  async init(playerElement: HTMLElement) {
    assert.ok(!this.player, 'Player already initialized');
    assert.ok(playerElement, 'Player element is required');
    if (
      this.config.debug === 'all' ||
      this.config.debug === 'clappr'
    ) {
      Log.setLevel(0);
    }

    Log.debug('Config', this.config);

    this.configurePlugins();
    return this.loadPlugins().then(async () => {
      const coreOpts = this.buildCoreOptions(playerElement);
      const {
        core,
        container,
      } = Loader.registeredPlugins;
      coreOpts.plugins = {
        core: Object.values(core),
        container: Object.values(container),
        playback: Loader.registeredPlaybacks,
      } as CorePluginOptions;
      console.log('plugins', coreOpts.plugins);
      return this.initPlayer(coreOpts);
    });
  }

  destroy() {
    trace(`${T} destroy`, { player: !!this.player });
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
  }

  pause() {
    assert.ok(this.player, 'Player not initialized');
    this.player.pause();
  }

  play() {
    assert.ok(this.player, 'Player not initialized');
    this.player.play();
  }

  seekTo(time: number) {
    assert.ok(this.player, 'Player not initialized');
    this.player.seek(time);
  }

  stop() {
    assert.ok(this.player, 'Player not initialized');
    this.player.stop();
  }

  static registerPlugin(plugin: PlayerPlugin) {
    Loader.registerPlugin(plugin);
  }

  private loadPlugins(): Promise<void> {
    return Promise.all(this.pluginLoaders.map((loader) => loader())).then(() => { });
  }

  private initPlayer(coreOptions: CoreOptions) {
    assert.ok(!this.player, 'Player already initialized');

    const player = new PlayerClappr(
      coreOptions
    );
    this.player = player;

    this.timer = globalThis.setTimeout(() => {
      try {
        if (
          !this.clapprReady &&
          player.core &&
          player.core
            .activePlayback
        ) {
          this.tuneIn();
          // player.onReady = null; // TODO ?
        }
      } catch (e) {
        reportError(e);
      }
    }, 4000);
  }

  // TODO sort this out
  private async tuneIn() {
    assert.ok(this.player);
    trace(`${T} tuneIn enter`, {
      ready: this.clapprReady,
      tuneInEntered: this.tuneInEntered,
    });
    if (this.tuneInEntered) {
      return;
    }
    this.tuneInEntered = true;
    const player = this.player;
    if (
      Browser.isiOS &&
      player.core.activePlayback
    ) {
      player.core.activePlayback.$el.on(
        'webkitendfullscreen',
        () => {
          try {
            player.core.handleFullscreenChange();
          } catch (e) {
            reportError(e);
          }
        },
      );
    }
  }

  private configurePlugins() {
    if (!Browser.isiOS && this.config.multisources.some((el) => el.sourceDash)) {
      this.scheduleLoad(async () => {
        const module = await import('./plugins/dash-playback/DashPlayback.js');
        Loader.registerPlayback(module.default);
      })
    }
    // TODO remove !isiOS?
    // if (!Browser.isiOS && this.config.multisources.some((el) => el.hls_mpegts_url)) {
    if (this.config.multisources.some((el) => el.hlsMpegtsUrl || el.hlsCmafUrl || el.source.endsWith('.m3u8'))) {
      this.scheduleLoad(async () => {
        const module = await import('./plugins/hls-playback/HlsPlayback.js');
        Loader.registerPlayback(module.default);
      })
    }
  }

  private events: CorePlayerEvents = {
    onReady: () => {
      if (this.clapprReady) {
        return;
      }
      this.clapprReady = true;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      trace(`${T} onReady`);
      setTimeout(() => this.tuneIn(), 0);
      try {
        this.emitter.emit(PlayerEvent.Ready);
      } catch (e) {
        reportError(e);
      }
    },
    onPlay: () => {
      try {
        this.emitter.emit(PlayerEvent.Play);
      } catch (e) {
        reportError(e);
      }
    },
    onPause: () => {
      try {
        this.emitter.emit(PlayerEvent.Pause);
      } catch (e) {
        reportError(e);
      }
    },
    onEnded: () => {
      try {
        this.emitter.emit(PlayerEvent.Ended);
      } catch (e) {
        reportError(e);
      }
    },
    onStop: () => {
      try {
        this.emitter.emit(PlayerEvent.Stop);
      } catch (e) {
        reportError(e);
      }
    },
  };

  private buildCoreOptions(playerElement: HTMLElement): CoreOptions {
    this.checkMediaTransportsSupport();
    const multisources = this.processMultisources(this.config.priorityTransport);
    const mediaSources = multisources.map(ms => ms.source);
    const mainSource = this.findMainSource();
    const mainSourceUrl = unwrapSource(mainSource ? this.selectMediaTransport(mainSource, this.config.priorityTransport) : undefined);
    const poster = mainSource?.poster ?? this.config.poster;

    const coreOptions: CoreOptions & PluginOptions = {
      autoPlay: this.config.autoPlay,
      debug: this.config.debug || 'none',
      events: this.events,
      multisources,
      mute: this.config.mute,
      ...this.config.pluginSettings,
      playback: {
        controls: false,
        preload: Browser.isiOS ? 'metadata' : 'none',
        playInline: true,
        crossOrigin: 'anonymous', // TODO
        hlsjsConfig: {
          debug: this.config.debug === 'all' || this.config.debug === 'hls',
        },
      },
      parent: playerElement,
      playbackType: this.config.playbackType,
      poster,
      width: playerElement.clientWidth,
      height: playerElement.clientHeight,
      loop: this.config.loop,
      strings: this.config.strings,
      source: mainSourceUrl,
      sources: mediaSources,
    };
    trace(`${T} buildCoreOptions`, coreOptions);
    return coreOptions;
  }

  private findMainSource(): StreamMediaSource | undefined {
    return this.config.multisources.find(ms => ms.live !== false);
  }

  private scheduleLoad(cb: () => Promise<void>) {
    this.pluginLoaders.push(cb);
  }

  private selectMediaTransport(ms: StreamMediaSource, priorityTransport: TransportPreference = ms.priorityTransport): string {
    const cmafUrl = ms.hlsCmafUrl || ms.source; // source is default url for hls
    const mpegtsUrl = ms.hlsMpegtsUrl; // no-low-latency HLS
    const dashUrl = ms.sourceDash;
    const masterSource = ms.source;

    const mts = this.getAvailableTransportsPreference(priorityTransport);
    for (const mt of mts) {
      switch (mt) {
        case 'dash':
          if (dashUrl) {
            return dashUrl;
          }
          break;
        case 'hls':
          if (cmafUrl) {
            return cmafUrl;
          }
          break;
        default:
          return mpegtsUrl || masterSource;
      }
    }
    // no supported transport found
    return '';
  }

  private getAvailableTransportsPreference(priorityTransport: TransportPreference): MediaTransport[] {
    const mtp: MediaTransport[] = [];
    if (priorityTransport !== 'auto' && this.supportedMediaTransports.includes(priorityTransport)) {
      mtp.push(priorityTransport);
    }
    for (const mt of this.supportedMediaTransports) {
      if (mt !== priorityTransport) {
        mtp.push(mt);
      }
    }
    return mtp;
  }

  private checkMediaTransportsSupport() {
    const isDashSupported = typeof (globalThis.MediaSource || (globalThis as any).WebKitMediaSource) === 'function';
    if (isDashSupported) {
      this.supportedMediaTransports.push('dash');
    }
    if (Hls.isSupported()) {
      this.supportedMediaTransports.push('hls');
    }
    this.supportedMediaTransports.push('mpegts');
  }

  private processMultisources(transport?: TransportPreference): StreamMediaSource[] {
    return this.config.multisources.map((ms: StreamMediaSource): StreamMediaSource => ({
      ...ms,
      source: this.selectMediaTransport(ms, transport),
    })).filter((el): el is StreamMediaSource => !!el.source);
  }
}

function unwrapSource(s: PlayerMediaSource | undefined): string | undefined {
  if (!s) {
    return;
  }
  return typeof s === "string" ? s : s.source;
}
