import {
  Browser,
  Events as ClapprEvents,
  Log,
  Player as PlayerClappr,
  $,
  Loader,
} from '@clappr/core';
import assert from 'assert';
import EventLite from "event-lite";

import type {
  CorePlayerEvents,
  CoreOptions,
  CorePluginOptions,
} from "./internal.types.js";
import type {
  BitrateInfo,
  PlaybackType,
  PlayerPlugin,
  StreamMediaSource,
} from "./types.js";
import { reportError } from "./trace/index.js";
import {
  PlayerConfig,
  PlayerEvent,
} from "./types.js";
import DashPlayback from './plugins/dash-playback/DashPlayback.js';
import HlsPlayback from './plugins/hls-playback/HlsPlayback.js';

import '../assets/style/main.scss'; // TODO check if needed

// TODO implement transport retry/failover and fallback logic

type PlayerEventHandler<T extends PlayerEvent> = () => void;

const T = "GPlayer";

const DEFAULT_OPTIONS: Partial<PlayerConfig> = {
  autoPlay: false,
  mute: false,
  loop: false,
}

export type PlaybackModule = 'dash' | 'hls' | 'native';

type PluginOptions = Record<string, unknown>;

/**
 * @beta
 */
export class Player {
  private bitrateInfo: BitrateInfo | null = null;

  private config: PlayerConfig;

  private emitter = new EventLite();

  private player: PlayerClappr | null = null;

  private ready = false;

  private tuneInTimerId: ReturnType<typeof setTimeout> | null = null;

  private tunedIn = false;

  get activePlayback(): PlaybackModule | null {
    if (!this.player?.core.activePlayback) {
      return null;
    }
    switch (this.player.core.activePlayback.name) {
      case 'dash':
        return 'dash';
      case 'hls':
        return 'hls';
      default:
        return 'native';
    }
  }

  get bitrate(): BitrateInfo | null {
    return this.bitrateInfo;
  }

  get hd() {
    return this.player?.core.activePlayback?.isHighDefinitionInUse || false;
  }

  get playbackType(): PlaybackType | undefined {
    return this.player?.core.activePlayback?.getPlaybackType();
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

  configure(config: Partial<PlayerConfig>) {
    $.extend(true, this.config, config);
  }

  async init(playerElement: HTMLElement) {
    assert.ok(!this.player, 'Player already initialized');
    assert.ok(playerElement, 'Player container element is required');
    if (
      this.config.debug === 'all' ||
      this.config.debug === 'clappr'
    ) {
      Log.setLevel(0);
    }

    Log.debug(T, 'Config', this.config);

    this.configurePlaybacks();
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
    Log.debug(T, 'coreOpts', coreOpts);
    return this.initPlayer(coreOpts);
  }

  destroy() {
    Log.debug(T, 'destroy', { player: !!this.player });
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    this.ready = false;
    this.tunedIn = false;
    if (this.tuneInTimerId) {
      clearTimeout(this.tuneInTimerId);
      this.tuneInTimerId = null;
    }
    this.bitrateInfo = null;
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

  static unregisterPlugin(plugin: PlayerPlugin) {
    Loader.unregisterPlugin(plugin);
  }

  private initPlayer(coreOptions: CoreOptions) {
    assert.ok(!this.player, 'Player already initialized');

    const player = new PlayerClappr(
      coreOptions
    );
    this.player = player;

    // TODO checks if the whole thing is necessary
    this.tuneInTimerId = globalThis.setTimeout(() => {
      Log.debug(T, 'tuneInTimer', { ready: this.ready, tunedIn: this.tunedIn });
      this.tuneInTimerId = null;
      this.tuneIn();
    }, 4000);
  }

  private async tuneIn() {
    assert.ok(this.player);
    Log.debug(T, 'tuneIn', {
      ready: this.ready,
      tunedIn: this.tunedIn,
    });
    if (this.tunedIn) {
      return;
    }
    this.tunedIn = true;
    const player = this.player;
    try {
      this.emitter.emit(PlayerEvent.Ready);
    } catch (e) {
      reportError(e);
    }
    if (player.core.activeContainer) {
      this.bindBitrateChangeHandler();
    }
    player.core.on(ClapprEvents.CORE_ACTIVE_CONTAINER_CHANGED, () => {
      this.bindBitrateChangeHandler();
    }, null);
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
    if (this.config.autoPlay) {
      setTimeout(() => {
        Log.debug(T, 'autoPlay');
        assert(this.player);
        this.player.play({ autoPlay: true });
      }, 0)
    }
  }

  private events: CorePlayerEvents = {
    onReady: () => {
      Log.debug(T, 'onReady', {
        ready: this.ready,
      });
      if (this.ready) {
        return;
      }
      this.ready = true;
      if (this.tuneInTimerId) {
        clearTimeout(this.tuneInTimerId);
        this.tuneInTimerId = null;
      }
      setTimeout(() => this.tuneIn(), 0);
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
    const multisources = this.config.multisources;
    const mainSource = this.config.playbackType === 'live' ? multisources.find(ms => ms.live !== false) : multisources[0];
    const mediaSources = mainSource ? this.buildMediaSourcesList(mainSource) : [];
    const mainSourceUrl = mediaSources[0];
    const poster = mainSource?.poster ?? this.config.poster;

    const coreOptions: CoreOptions & PluginOptions = {
      ...this.config.pluginSettings,
      autoPlay: false,
      debug: this.config.debug || 'none',
      events: this.events,
      height: playerElement.clientHeight,
      loop: this.config.loop,
      multisources,
      mute: this.config.mute,
      playback: {
        controls: false,
        preload: Browser.isiOS ? 'metadata' : 'none',
        playInline: true,
        mute: this.config.mute,
        crossOrigin: 'anonymous', // TODO
        hlsjsConfig: {
          debug: this.config.debug === 'all' || this.config.debug === 'hls',
        },
      },
      parent: playerElement,
      playbackType: this.config.playbackType,
      poster,
      width: playerElement.clientWidth,
      source: mainSourceUrl,
      sources: mediaSources,
      strings: this.config.strings,
    };
    return coreOptions;
  }

  private configurePlaybacks() {
    Loader.registerPlayback(DashPlayback);
    Loader.registerPlayback(HlsPlayback);
  }

  private bindBitrateChangeHandler() {
    this.player?.core.activeContainer.on(ClapprEvents.CONTAINER_BITRATE, (bitrate: BitrateInfo) => {
      this.bitrateInfo = bitrate;
    });
  }

  private buildMediaSourcesList(ms: StreamMediaSource): string[] {
    const msl: string[] = [];
    const sources: Record<'dash' | 'master' | 'hls' | 'mpegts', string | null> = {
      dash: ms.sourceDash,
      master: ms.source,
      hls: ms.hlsCmafUrl,
      mpegts: ms.hlsMpegtsUrl,
    }
    switch (this.config.priorityTransport) {
      case 'dash':
        if (sources.dash) {
          msl.push(sources.dash);
          sources.dash = null;
        }
        break;
      case 'hls':
        if (sources.hls) {
          msl.push(sources.hls);
          sources.hls = null;
        }
        if (sources.master?.endsWith('.m3u8')) {
          msl.push(sources.master);
          sources.master = null;
        }
        break;
      case 'mpegts':
        if (sources.mpegts) {
          msl.push(sources.mpegts);
          sources.mpegts = null
        }
        break;
    }
    Object.values(sources).forEach(s => {
      if (s) {
        msl.push(s);
      }
    });
    return msl;
  }
}
