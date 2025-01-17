import {
  Browser,
  Events as ClapprEvents,
  Log,
  Player as PlayerClappr,
  $,
  Loader,
} from '@clappr/core'
import assert from 'assert'
import EventLite from 'event-lite'

import type {
  CorePlayerEvents,
  CoreOptions,
  CorePluginOptions,
  PlayerMediaSource,
} from './internal.types.js'
import type {
  PlaybackType,
  PlayerPlugin,
  QualityLevelInfo,
  StreamMediaSource,
  TransportPreference,
} from './types.js'
import { reportError, trace } from './trace/index.js'
import { PlayerConfig, PlayerEvent } from './types.js'
import DashPlayback from './plugins/dash-playback/DashPlayback.js'
import HlsPlayback from './plugins/hls-playback/HlsPlayback.js'
import { buildSourcesPriorityList, buildSourcesSet, unwrapSource } from './utils/mediaSources.js'

// TODO implement transport retry/failover and fallback logic

type PlayerEventHandler<T extends PlayerEvent> = () => void

const T = 'GPlayer'

const DEFAULT_OPTIONS: PlayerConfig = {
  autoPlay: false,
  debug: 'none',
  loop: false,
  mute: false,
  multisources: [],
  playbackType: 'vod',
  pluginSettings: {},
  poster: '',
  priorityTransport: 'dash',
  sources: [],
  strings: {},
}

export type PlaybackModule = 'dash' | 'hls' | 'native'

type PluginOptions = Record<string, unknown>

/**
 * @beta
 */
export class Player {
  private qLevel: QualityLevelInfo | null = null

  private config: PlayerConfig = DEFAULT_OPTIONS

  private emitter = new EventLite()

  private player: PlayerClappr | null = null

  private ready = false

  private rootNode: HTMLElement | null = null

  private tuneInTimerId: ReturnType<typeof setTimeout> | null = null

  private tunedIn = false

  get activePlayback(): PlaybackModule | null {
    if (!this.player?.core.activePlayback) {
      return null
    }
    switch (this.player.core.activePlayback.name) {
      case 'dash':
        return 'dash'
      case 'hls':
        return 'hls'
      default:
        return 'native'
    }
  }

  get activeSource(): string | null {
    if (!this.player?.core.activePlayback) {
      return null
    }
    return this.player.core.activePlayback.options.src
  }

  get bitrate(): QualityLevelInfo | null {
    return this.qLevel
  }

  get hd() {
    return this.player?.core.activePlayback?.isHighDefinitionInUse || false
  }

  get playbackType(): PlaybackType | undefined {
    return this.player?.core.activePlayback?.getPlaybackType()
  }

  constructor(config: PlayerConfig) {
    this.setConfig(config)
  }

  on<T extends PlayerEvent>(event: T, handler: PlayerEventHandler<T>) {
    this.emitter.on(event, handler)
  }

  off<T extends PlayerEvent>(event: T, handler: PlayerEventHandler<T>) {
    this.emitter.off(event, handler)
  }

  configure(config: Partial<PlayerConfig>) {
    this.setConfig(config)
  }

  private setConfig(config: Partial<PlayerConfig>) {
    this.config = $.extend(true, this.config, config)
  }

  async init(playerElement: HTMLElement) {
    assert.ok(!this.player, 'Player already initialized')
    assert.ok(playerElement, 'Player container element is required')
    if (this.config.debug === 'all' || this.config.debug === 'clappr') {
      Log.setLevel(0)
    }

    trace(`${T} init`, {
      config: this.config,
    })

    this.configurePlaybacks()
    const coreOpts = this.buildCoreOptions(playerElement)
    const { core, container } = Loader.registeredPlugins
    trace(`${T} init`, {
      registeredPlaybacks: Loader.registeredPlaybacks.map((p) => p.name),
    })
    coreOpts.plugins = {
      core: Object.values(core),
      container: Object.values(container),
      playback: Loader.registeredPlaybacks,
    } as CorePluginOptions
    return this.initPlayer(coreOpts)
  }

  destroy() {
    trace(`${T} destroy`, {
      player: !!this.player,
    })
    if (this.player) {
      this.player.destroy()
      this.player = null
    }
    this.ready = false
    this.tunedIn = false
    if (this.tuneInTimerId) {
      clearTimeout(this.tuneInTimerId)
      this.tuneInTimerId = null
    }
    this.qLevel = null
  }

  pause() {
    assert.ok(this.player, 'Player not initialized')
    this.player.pause()
  }

  play() {
    assert.ok(this.player, 'Player not initialized')
    this.player.play()
  }

  seekTo(time: number) {
    assert.ok(this.player, 'Player not initialized')
    this.player.seek(time)
  }

  stop() {
    assert.ok(this.player, 'Player not initialized')
    this.player.stop()
  }

  static registerPlugin(plugin: PlayerPlugin) {
    Loader.registerPlugin(plugin)
  }

  static unregisterPlugin(plugin: PlayerPlugin) {
    Loader.unregisterPlugin(plugin)
  }

  private initPlayer(coreOptions: CoreOptions) {
    trace(`${T} initPlayer`, {
      coreOptions,
    })

    assert.ok(!this.player, 'Player already initialized')

    const player = new PlayerClappr(coreOptions)
    this.player = player

    // TODO checks if the whole thing is necessary
    this.tuneInTimerId = globalThis.setTimeout(() => {
      trace(`${T} tuneInTimer`, {
        ready: this.ready,
        tunedIn: this.tunedIn,
      })
      this.tuneInTimerId = null
      this.tuneIn()
    }, 4000)
  }

  private async tuneIn() {
    assert.ok(this.player)
    trace(`${T} tuneIn`, {
      ready: this.ready,
      tunedIn: this.tunedIn,
    })
    if (this.tunedIn) {
      return
    }
    this.tunedIn = true
    const player = this.player
    try {
      this.emitter.emit(PlayerEvent.Ready)
    } catch (e) {
      reportError(e)
    }
    if (player.core.activeContainer) {
      this.bindBitrateChangeHandler()
    }
    player.core.on(
      ClapprEvents.CORE_ACTIVE_CONTAINER_CHANGED,
      () => {
        this.bindBitrateChangeHandler()
      },
      null,
    )
    if (Browser.isiOS && player.core.activePlayback) {
      player.core.activePlayback.$el.on('webkitendfullscreen', () => {
        try {
          player.core.handleFullscreenChange()
        } catch (e) {
          reportError(e)
        }
      })
    }
    player.core.on(
      ClapprEvents.CORE_SCREEN_ORIENTATION_CHANGED,
      ({ orientation }: { orientation: 'landscape' | 'portrait' }) => {
        trace(`${T} CORE_SCREEN_ORIENTATION_CHANGED`, {
          orientation,
          rootNode: {
            width: this.rootNode?.clientWidth,
            height: this.rootNode?.clientHeight,
          },
        })
        if (Browser.isiOS && this.rootNode) {
          player.core.resize({
            width: this.rootNode.clientWidth,
            height: this.rootNode.clientHeight,
          })
        }
      },
      null,
    )
    player.core.on(
      ClapprEvents.CORE_RESIZE,
      ({ width, height }: { width: number; height: number }) => {
        trace(`${T} CORE_RESIZE`, {
          width,
          height,
        })
      },
      null,
    )
    if (this.config.autoPlay) {
      setTimeout(() => {
        trace(`${T} autoPlay`, {
          player: !!this.player,
          container: !!this.player?.core.activeContainer,
          playback: this.player?.core.activePlayback.name,
        })
        assert(this.player)
        this.player.play({
          autoPlay: true,
        })
      }, 0)
    }
  }

  private events: CorePlayerEvents = {
    onReady: () => {
      trace(`${T} onReady`, {
        ready: this.ready,
      })
      if (this.ready) {
        return
      }
      this.ready = true
      if (this.tuneInTimerId) {
        clearTimeout(this.tuneInTimerId)
        this.tuneInTimerId = null
      }
      setTimeout(() => this.tuneIn(), 0)
    },
    onResize: (newSize: { width: number; height: number }) => {
      trace(`${T} onResize`, {
        newSize,
      })
    },
    onPlay: () => {
      try {
        this.emitter.emit(PlayerEvent.Play)
      } catch (e) {
        reportError(e)
      }
    },
    onPause: () => {
      try {
        this.emitter.emit(PlayerEvent.Pause)
      } catch (e) {
        reportError(e)
      }
    },
    onEnded: () => {
      try {
        this.emitter.emit(PlayerEvent.Ended)
      } catch (e) {
        reportError(e)
      }
    },
    onStop: () => {
      try {
        this.emitter.emit(PlayerEvent.Stop)
      } catch (e) {
        reportError(e)
      }
    },
  }

  private buildCoreOptions(rootNode: HTMLElement): CoreOptions {
    // TODO extract
    // const multisources = this.config.multisources
    // const mainSource =
    //   this.config.playbackType === 'live'
    //     ? multisources.find((ms) => ms.live !== false)
    //     : multisources[0]
    // const mediaSources = mainSource
    //   ? this.buildMediaSourcesList(mainSource)
    //   : []
    // const mainSourceUrl = mediaSources[0];
    // const poster = mainSource?.poster ?? this.config.poster
    const poster = this.config.poster

    const source = this.selectMediaSource(); // TODO

    this.rootNode = rootNode

    const coreOptions: CoreOptions & PluginOptions = {
      ...this.config.pluginSettings,
      allowUserInteraction: true,
      autoPlay: false,
      debug: this.config.debug || 'none',
      events: this.events,
      height: rootNode.clientHeight,
      loop: this.config.loop,
      mute: this.config.mute,
      playback: {
        controls: false,
        playInline: true,
        preload: Browser.isiOS ? 'metadata' : 'none',
        mute: this.config.mute,
        crossOrigin: 'anonymous', // TODO
        hlsjsConfig: {
          debug: this.config.debug === 'all' || this.config.debug === 'hls',
        },
      },
      parent: rootNode,
      playbackType: this.config.playbackType,
      poster,
      width: rootNode.clientWidth,
      source: source ? unwrapSource(source) : undefined,
      // sources: mediaSources,
      strings: this.config.strings,
    }
    return coreOptions
  }

  private configurePlaybacks() {
    // TODO check if there are DASH and HLS sources and don't register the respective playbacks if not
    Loader.registerPlayback(DashPlayback)
    Loader.registerPlayback(HlsPlayback)
  }

  private bindBitrateChangeHandler() {
    this.player?.core.activeContainer.on(
      ClapprEvents.CONTAINER_BITRATE,
      (bitrate: QualityLevelInfo) => {
        this.qLevel = bitrate
      },
    )
  }

  // Select a single source to play according to the priority transport and the modules support
  private selectMediaSource(): PlayerMediaSource | undefined {
    return buildSourcesPriorityList(buildSourcesSet(this.config.sources), this.config.priorityTransport)[0]
  }
}
