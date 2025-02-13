import {
  Browser,
  Events as ClapprEvents,
  Log,
  Player as PlayerClappr,
  $,
  Loader,
} from '@clappr/core'
import { reportError, trace } from '@gcorevideo/utils'
import assert from 'assert'
import EventLite from 'event-lite'

import type {
  CorePlayerEvents,
  CoreOptions,
  CorePluginOptions,
} from './internal.types.js'
import type { PlayerMediaSourceDesc, PlayerPlugin } from './types.js'
import { PlayerConfig, PlayerEvent } from './types.js'
import {
  buildMediaSourcesList,
  wrapSource,
} from './utils/mediaSources.js'
import { registerPlaybacks } from './playback/index.js'

/**
 * @beta
 */
export type PlayerEventHandler<T extends PlayerEvent> = () => void

const T = 'GPlayer'

const DEFAULT_OPTIONS: PlayerConfig = {
  autoPlay: false,
  debug: 'none',
  loop: false,
  mute: false,
  playbackType: 'vod',
  priorityTransport: 'dash',
  sources: [],
  strings: {},
}

/**
 * @beta
 */
export type PlaybackModule = 'dash' | 'hls' | 'html5_video'

type PluginOptions = Record<string, unknown>

/**
 * The main component to use in the application code.
 * @remarks
 * The Player object provides very basic API to control playback.
 * To build a sophisticated UI, use the plugins framework to tap into the Clappr core.
 * {@link https://github.com/clappr/clappr/wiki/Architecture}
 * @beta
 */
export class Player {
  private config: PlayerConfig = DEFAULT_OPTIONS

  private emitter = new EventLite()

  private player: PlayerClappr | null = null

  private ready = false

  private rootNode: HTMLElement | null = null

  private tuneInTimerId: ReturnType<typeof setTimeout> | null = null

  private tunedIn = false

  constructor(config: PlayerConfig) {
    this.setConfig(config)
    // TODO decide whether the order of playback modules might vary,
    // e.g., for a case of a conflict between dash and hls over the same media source
    this.configurePlaybacks()
  }

  /**
   * Adds a listener to a player event
   * @param event - See {@link PlayerEvent}
   * @param handler - See {@link PlayerEventHandler}
   */
  on<T extends PlayerEvent>(event: T, handler: PlayerEventHandler<T>) {
    this.emitter.on(event, handler)
  }

  /**
   * Removes a previously added event listener
   * @param event - See {@link PlayerEvent}
   * @param handler - See {@link PlayerEventHandler}
   */
  off<T extends PlayerEvent>(event: T, handler: PlayerEventHandler<T>) {
    this.emitter.off(event, handler)
  }

  /**
   * Configures the player.
   *
   * @param config - complete or partial configuration
   * @remarks
   * Can be called multiple times.
   * Each consequent call extends the previous configuration with only the new keys overridden.
   *
   * After a reconfiguration, if something significant has changed, it might make sense reinitialize the player (i.e, a `.destroy()` followed by an `.init()` call).
   */
  configure(config: Partial<PlayerConfig>) {
    this.setConfig(config)
  }

  /**
   * Initializes the player at the given container element.
   * @param playerElement - DOM element to host the player
   * @remarks
   * The player will be initialized and attached to the given element.
   *
   * All the core plugins will be initialized at this point.
   *
   * If no sources were configured, it will trigger an error.
   *
   * The player container will be initialized and then all the registered UI plugins.
   *
   * If the `autoPlay` option is set, then it will trigger playback immediately.
   *
   * It is an error to call this method twice. If you need to attache player to another DOM element,
   * first call {@link Player.destroy} and then {@link Player.attachTo}.
   *
   * @example
   * ```ts
   * const player = new Player({
   *   sources: [{ source: 'https://example.com/a.mpd', mimeType: 'application/dash+xml' }],
   * })
   * document.addEventListener('DOMContentLoaded', () => {
   *   player.attachTo(document.getElementById('video-container'))
   * })
   * ```
   */
  attachTo(playerElement: HTMLElement): void {
    assert.ok(!this.player, 'Player already initialized')
    assert.ok(playerElement, 'Player container element is required')
    if (this.config.debug === 'all' || this.config.debug === 'clappr') {
      Log.setLevel(0)
    }

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

  /**
   * Destroys the player, releasing all resources and unmounting its UI from the DOM.
   */
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
  }

  /**
   * Current playback (time since the beginning of the stream), if appropriate.
   *
   * @returns Time in seconds
   * @remarks
   * For live streams, it returns the current time within the current segment.
   */
  getCurrentTime(): number {
    if (!this.player) {
      return 0
    }
    return this.player.getCurrentTime()
  }

  /**
   * Duration of the current media in seconds, if appropriate.
   *
   * @returns Time in seconds
   * @remarks
   * For live streams, it returns the duration of the current segment.
   */
  getDuration(): number {
    if (!this.player) {
      return 0
    }
    return this.player.getDuration()
  }

  /**
   * Indicates whether DVR is enabled.
   */
  isDvrEnabled(): boolean {
    return this.player?.isDvrEnabled() ?? false
  }

  /**
   * Indicates the playing state of the player.
   */
  isPlaying(): boolean {
    return this.player?.isPlaying() ?? false
  }

  /**
   * Mutes the sound of the video.
   */
  mute() {
    this.player?.mute()
  }

  /**
   * Unmutes the video sound.
   */
  unmute() {
    this.player?.unmute()
  }

  /**
   * Pauses playback.
   */
  pause() {
    this.player?.pause()
  }

  /**
   * Starts playback.
   */
  play() {
    this.player?.play()
  }

  /**
   * Resizes the player container element and everything within it.
   * @param newSize - new size of the player
   * @remarks
   * Use this method when the player itself does not detect the change in size of its container element.
   * It can be a case for orientation change on some mobile devices.
   */
  resize(newSize: { width: number; height: number }) {
    this.player?.resize(newSize)
  }

  /**
   * Seeks to the given time.
   * @param time - time to seek to in seconds (since the beginning of the stream)
   */
  seek(time: number) {
    this.player?.seek(time)
  }

  /**
   * Gets the current volume of the media content being played.
   * @returns a number between 0 and 1
   */
  getVolume(): number {
    // This method is provided by the MediaControl plugin
    // @ts-ignore
    return this.player?.getVolume?.() || 0
  }

  /**
   * Sets the current volume of the media content being played.
   * @param volume - a number between 0 and 1
   */
  setVolume(volume: number) {
    // This method is provided by the MediaControl plugin
    // @ts-ignore
    this.player?.setVolume?.(volume)
  }

  /**
   * Stops playback.
   */
  stop() {
    this.player?.stop()
  }

  /**
   * Registers a plugin.
   * @param plugin - a plugin class
   * @remarks
   * Use this method to extend the player with custom behavior.
   * The plugin class must inherit from one of the Clappr UIPlugin, UIContainerPlugin or CorePlugin classes.
   * A core plugin will be initialized and attached to the player when the player is initialized.
   * A UI plugin will be initialized and attached to the player container is initialized.
   *
   * @see {@link https://github.com/clappr/clappr/wiki/Architecture}
   * @example
   * ```ts
   * import MyPlugin from './MyPlugin.js'
   * 
   * Player.registerPlugin(MyPlugin)
   * ```
   */
  static registerPlugin(plugin: PlayerPlugin) {
    Loader.registerPlugin(plugin)
  }

  /**
   * Unregisters a plugin registered earlier with {@link Player.registerPlugin}.
   * @param plugin - a plugin class
   */
  static unregisterPlugin(plugin: PlayerPlugin) {
    Loader.unregisterPlugin(plugin)
  }

  private setConfig(config: Partial<PlayerConfig>) {
    this.config = $.extend(true, this.config, config)
  }

  private initPlayer(coreOptions: CoreOptions): void {
    trace(`${T} initPlayer`, {
      // TODO selected options
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
    this.bindContainerEventListeners(player)
    player.core.on(
      ClapprEvents.CORE_ACTIVE_CONTAINER_CHANGED,
      () => this.bindContainerEventListeners(player),
      null,
    )
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
    player.core.on(
      ClapprEvents.CORE_FULLSCREEN,
      (isFullscreen: boolean) => {
        trace(`${T} CORE_FULLSCREEN`, {
          isFullscreen,
        })
      },
      null,
    )
    if (this.config.autoPlay) {
      setTimeout(() => {
        trace(`${T} autoPlay`, {
          playback: this.player?.core.activePlayback.name,
        })
        player.play({
          autoPlay: true,
        })
      }, 0)
    }
    try {
      this.emitter.emit(PlayerEvent.Ready)
    } catch (e) {
      reportError(e)
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
      // TODO ensure that CORE_ACTIVE_CONTAINER_CHANGED does not get caught before onReady
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
    const sources = this.buildMediaSourcesList()
    const source = sources[0]
    trace(`${T} buildCoreOptions`, {
      source,
      sources,
    })

    this.rootNode = rootNode

    const coreOptions: CoreOptions & PluginOptions = {
      ...this.config, // plugin settings
      allowUserInteraction: true,
      autoPlay: false,
      dash: this.config.dash, // TODO move this to the playback section
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
      width: rootNode.clientWidth,
      source: source ? source.source : undefined,
      mimeType: source ? source.mimeType : undefined,
      sources, // prevent Clappr from loading all sources simultaneously
      strings: this.config.strings,
    }
    return coreOptions
  }

  private configurePlaybacks() {
    registerPlaybacks()
  }

  private buildMediaSourcesList(): PlayerMediaSourceDesc[] {
    return buildMediaSourcesList(
      // TODO ensure unsupported sources are filtered out
      this.config.sources.map((s) => wrapSource(s)),
      this.config.priorityTransport,
    )
  }

  private bindContainerEventListeners(player: PlayerClappr) {
    trace(`${T} bindContainerEventListeners`, {
      activePlayback: player.core.activePlayback?.name,
    })
    if (Browser.isiOS && player.core.activePlayback) {
      player.core.activePlayback.$el.on('webkitendfullscreen', () => {
        try {
          player.core.handleFullscreenChange()
        } catch (e) {
          reportError(e)
        }
      })
    }
  }
}
