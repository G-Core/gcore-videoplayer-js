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
import EventEmitter from 'eventemitter3'

import type {
  CorePlayerEvents,
  CoreOptions,
  CorePluginOptions,
} from './internal.types.js'
import type {
  ContainerSize,
  PlayerMediaSource,
  PlayerMediaSourceDesc,
  PlayerPluginConstructor,
} from './types.js'
import { PlayerConfig, PlayerEvent } from './types.js'
import { buildMediaSourcesList, wrapSource } from './utils/mediaSources.js'
import { registerPlaybacks } from './playback/index.js'
import { PlaybackError, TimePosition } from './playback.types.js'
import { SourceController } from './plugins/source-controller/SourceController.js'

/**
 * @public
 */
export type PlayerEventParams<E extends PlayerEvent> =
  E extends PlayerEvent.Seek
    ? [number]
    : E extends PlayerEvent.VolumeUpdate
    ? [number]
    : E extends PlayerEvent.TimeUpdate
    ? [TimePosition]
    : E extends PlayerEvent.Resize
    ? [{ width: number; height: number }]
    : E extends PlayerEvent.Fullscreen
    ? [boolean]
    : E extends PlayerEvent.Error
    ? [PlaybackError]
    : []

/**
 * Type of a listener callback function for a player event.
 * See the description of the event parameters in {@link PlayerEvent}.
 * @public
 */
export type PlayerEventHandler<E extends PlayerEvent> = (
  ...args: PlayerEventParams<E>
) => void

const T = 'gplayer'

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
 * Module to perform the playback.
 * @public
 */
export type PlaybackModule = 'dash' | 'hls' | 'html5_video'

type PluginOptions = Record<string, unknown>

/**
 * `MAIN` component to use in the application code.
 * @public
 * @remarks
 * The Player object provides very basic API to control playback.
 * To build a sophisticated UI, use the plugins framework to tap into the Clappr core.
 * {@link https://github.com/clappr/clappr/wiki/Architecture}
 */
export class Player {
  private config: PlayerConfig = DEFAULT_OPTIONS

  private emitter = new EventEmitter()

  private player: PlayerClappr | null = null

  private ready = false

  private rootNode: HTMLElement | null = null

  constructor(config: PlayerConfig) {
    this.setConfig(config)
    // TODO decide whether the order of playback modules might vary,
    // e.g., for a case of a conflict between dash and hls over the same media source
    this.configurePlaybacks()
  }

  /**
   * Adds a listener to a player event
   * @param event - event type, see {@link PlayerEvent}
   * @param handler - a callback function to handle the event
   */
  on<E extends PlayerEvent>(event: E, handler: PlayerEventHandler<E>) {
    this.emitter.on(event, handler)
  }

  /**
   * Removes a previously added event listener
   * @param event - See {@link PlayerEvent}
   * @param handler - a callback attached earlier to that event type
   */
  off<E extends PlayerEvent>(event: E, handler: PlayerEventHandler<E>) {
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
    const { core, container } = Player.getRegisteredPlugins()
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
    if (this.player) {
      this.player.destroy()
      this.player = null
    }
    this.ready = false
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
   * Indicates whether DVR is in use.
   * @remarks
   * DVR mode, if it is enabled, is triggered we a user seeks behind the live edge.
   */
  isDvrInUse(): boolean {
    return this.player?.isDvrInUse() ?? false
  }

  /**
   * Indicates muted state of the video.
   * @remarks
   * Note that muted state is independent from the volume level.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/muted}
   */
  isMuted(): boolean {
    return this.player?.core.activePlayback.isMuted() ?? false
  }

  /**
   * Indicates the playing state.
   */
  isPlaying(): boolean {
    return this.player?.isPlaying() ?? false
  }

  /**
   * Loads new media source
   * @param mediaSources - list of media sources to use
   * @beta
   */
  load(mediaSources: PlayerMediaSource[]) {
    if (mediaSources.length === 0) {
      throw new Error('No media sources provided')
    }
    trace('load', {
      mediaSources,
      player: !!this.player,
    })
    if (!this.player) {
      this.configure({
        sources: mediaSources,
      })
      return
    }
    const ms = mediaSources.map((s) => wrapSource(s))
    const sourceController = this.player?.core.getPlugin(
      'source_controller',
    ) as SourceController
    if (sourceController) {
      sourceController.setMediaSource(ms)
      return
    }
    this.player?.load(ms, ms[0].mimeType ?? '')
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
   * Use this method when the player itself does not detect properly the change in size of its container element.
   * It can be a case for orientation change on some mobile devices.
   */
  resize(newSize: ContainerSize) {
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
  static registerPlugin(plugin: PlayerPluginConstructor) {
    assert.ok(
      plugin.type === 'core' || plugin.type === 'container',
      'Invalid plugin type',
    )
    if (plugin.type === 'core') {
      if (plugin.prototype.name === 'media_control') {
        Player.corePlugins.unshift(plugin)
      } else {
        Player.corePlugins.push(plugin)
      }
      return
    }
    Loader.registerPlugin(plugin)
  }

  /**
   * Unregisters a plugin registered earlier with {@link Player.registerPlugin}.
   * @remarks
   * It can be also used to unregister a built-in default plugin.
   *
   * Currently, the plugins that are always registered are:
   *
   * - {@link https://github.com/clappr/clappr-core/blob/3126c3a38a6eee9d5aba3918b194e6380fa1178c/src/plugins/strings/strings.js | 'strings'}, which supports internationalization of the player UI
   *
   * - {@link https://github.com/clappr/clappr-core/blob/3126c3a38a6eee9d5aba3918b194e6380fa1178c/src/plugins/sources/sources.js | 'sources'}, which lets to specify multiple media sources and selects the first suitable playback module
   *
   * @param name - name of the plugin
   */
  static unregisterPlugin(name: string) {
    Player.corePlugins = Player.corePlugins.filter(
      (p) => p.prototype.name !== name,
    )
    Loader.unregisterPlugin(name)
  }

  private static getRegisteredPlugins(): {
    core: Record<string, PlayerPluginConstructor>
    container: Record<string, PlayerPluginConstructor>
  } {
    for (const plugin of Player.corePlugins) {
      Loader.registerPlugin(plugin)
    }
    return Loader.registeredPlugins
  }

  private static corePlugins: PlayerPluginConstructor[] = []

  private setConfig(config: Partial<PlayerConfig>) {
    this.config = $.extend(true, this.config, config)
  }

  private initPlayer(coreOptions: CoreOptions): void {
    const player = new PlayerClappr(coreOptions)
    this.player = player
    this.bindCoreListeners()
  }

  private async tuneIn() {
    assert.ok(this.player)
    this.bindContainerEventListeners()
    this.player.core.on(
      ClapprEvents.CORE_ACTIVE_CONTAINER_CHANGED,
      () => this.bindContainerEventListeners(),
      null,
    )
    if (this.config.autoPlay) {
      this.triggerAutoPlay()
    }
    try {
      this.emitter.emit(PlayerEvent.Ready)
    } catch (e) {
      reportError(e)
    }
  }

  private triggerAutoPlay() {
    trace(`${T} triggerAutoPlay`)
    setTimeout(() => {
      this.player?.play({
        autoPlay: true,
      })
    }, 0)
  }

  private safeTriggerEvent<E extends PlayerEvent>(
    event: E,
    ...args: PlayerEventParams<E>
  ) {
    try {
      this.emitter.emit(event, ...args)
    } catch (e) {
      reportError(e)
    }
  }

  // TODO test
  private events: CorePlayerEvents = {
    onReady: () => {
      trace(`${T} onReady`, {
        ready: this.ready,
      })
      if (this.ready) {
        return
      }
      this.ready = true
      setTimeout(() => this.tuneIn(), 0)
    },
    onPlay: () => {
      this.safeTriggerEvent(PlayerEvent.Play)
    },
    onPause: () => {
      this.safeTriggerEvent(PlayerEvent.Pause)
    },
    onEnded: () => {
      this.safeTriggerEvent(PlayerEvent.Ended)
    },
    onSeek: (time: number) => {
      this.safeTriggerEvent(PlayerEvent.Seek, time)
    },
    onStop: () => {
      this.safeTriggerEvent(PlayerEvent.Stop)
    },
    onTimeUpdate: (time: TimePosition) => {
      this.safeTriggerEvent(PlayerEvent.TimeUpdate, time)
    },
    onError: (error: PlaybackError) => {
      this.safeTriggerEvent(PlayerEvent.Error, error)
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

    const coreOptions: CoreOptions & PluginOptions = $.extend(
      true,
      {
        allowUserInteraction: true,
        debug: 'none',
        events: this.events,
        height: rootNode.clientHeight,
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
        width: rootNode.clientWidth,
      },
      this.config,
      {
        autoPlay: false,
        mimeType: source ? source.mimeType : undefined,
        source: source ? source.source : undefined,
        sources,
      },
    )
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

  private bindContainerEventListeners() {
    const activePlayback = this.player?.core.activePlayback
    const activeContainer = this.player?.core.activeContainer
    if (Browser.isiOS && activePlayback) {
      // TODO check out
      activePlayback.$el.on('webkitendfullscreen', () => {
        try {
          activeContainer?.handleFullscreenChange()
        } catch (e) {
          reportError(e)
        }
      })
    }
    activeContainer?.on(
      ClapprEvents.CONTAINER_VOLUME,
      (volume: number) => {
        this.safeTriggerEvent(PlayerEvent.VolumeUpdate, volume)
      },
      null,
    )
  }

  private bindCoreListeners() {
    // TODO create an class inherited from PlayerClappr
    assert.ok(this.player, 'Player is not initialized')
    const core = this.player.core
    core.on(
      ClapprEvents.CORE_SCREEN_ORIENTATION_CHANGED,
      ({ orientation }: { orientation: 'landscape' | 'portrait' }) => {
        if (Browser.isiOS && this.rootNode) {
          core?.resize({
            width: this.rootNode.clientWidth,
            height: this.rootNode.clientHeight,
          })
        }
      },
      null,
    )
    core.on(
      ClapprEvents.CORE_RESIZE,
      ({ width, height }: { width: number; height: number }) => {
        this.safeTriggerEvent(PlayerEvent.Resize, { width, height })
      },
      null,
    )
    core.on(
      ClapprEvents.CORE_FULLSCREEN,
      (isFullscreen: boolean) => {
        this.safeTriggerEvent(PlayerEvent.Fullscreen, isFullscreen)
      },
      null,
    )
  }
}
