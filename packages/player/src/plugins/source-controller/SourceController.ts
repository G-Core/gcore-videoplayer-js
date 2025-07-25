import {
  Events as Events,
  CorePlugin,
  type Core as ClapprCore,
} from '@clappr/core'
import { type PlaybackError, PlaybackErrorCode } from '../../playback.types.js'
import { type PlayerMediaSourceDesc } from '../../types.js'
import { trace } from '@gcorevideo/utils'
import { SpinnerEvents } from '../spinner-three-bounce/SpinnerThreeBounce.js'

import { CLAPPR_VERSION } from '../../build.js'

const T = 'plugins.source_controller'

const INITIAL_RETRY_DELAY = 1000

const MAX_RETRY_DELAY = 5000

const RETRY_DELAY_BLUR = 500

const VERSION = '0.0.1'

type SyncFn = (cb: () => void) => void

function noSync(cb: () => void) {
  queueMicrotask(cb)
}

/**
 * `PLUGIN` that is managing the automatic failover between media sources.
 * @public
 * @remarks
 * Have a look at the {@link https://miro.com/app/board/uXjVLiN15tY=/?share_link_id=390327585787 | source failover diagram} for the details
 * on how sources ordering and selection works. Below is a simplified diagram:
 *
 * ```markdown
 * sources_list:
 *       - a.mpd  |    +--------------------+
 *       - b.m3u8 |--->|         init       |
 *       - ...    |    |--------------------|
 *                     | current_source = 0 |
 *                     +--------------------+
 *                            |
 *                            |  source = a.mpd
 *                            |  playback = dash.js
 *                            v
 *                      +------------------+
 *                  +-->|   load source    |
 *                  |   +---------|--------+
 *                  |             v
 *                  |   +------------------+
 *                  |   |       play       |
 *                  |   +---------|--------+
 *                  |             |
 *                  |             v
 *                  |   +-----------------------+
 *                  |   |  on playback_error    |
 *                  |   |-----------------------|
 *                  |   | current_source =      |
 *                  |   |  (current_source + 1) |
 *                  |   |  % len sources_list   |
 *                  |   |                       |
 *                  |   | delay 1..3s           |
 *                  |   +---------------|-------+
 *                  |                   |
 *                  |   source=b.m3u8   |
 *                  |   playback=hls.js |
 *                  +-------------------+
 *
 * ```
 *
 * @example
 * ```ts
 * import { SourceController } from '@gcorevideo/player'
 *
 * Player.registerPlugin(SourceController)
 * ```
 */
export class SourceController extends CorePlugin {
  /*
   * The Logic itself is quite simple:
   * * Here is the short diagram:
   *
   * sources_list:
   *       - a.mpd  |    +--------------------+
   *       - b.m3u8 |--->|         init       |
   *       - ...    |    |--------------------|
   *                     | current_source = 0 |
   *                     +--------------------+
   *                            |
   *                            |  source = a.mpd
   *                            |  playback = dash.js
   *                            v
   *                      +------------------+
   *                  +-->|   load source    |
   *                  |   +---------|--------+
   *                  |             v
   *                  |   +------------------+
   *                  |   |       play       |
   *                  |   +---------|--------+
   *                  |             |
   *                  |             v
   *                  |   +-----------------------+
   *                  |   |  on playback_error    |
   *                  |   |-----------------------|
   *                  |   | current_source =      |
   *                  |   |  (current_source + 1) |
   *                  |   |  % len sources_list   |
   *                  |   |                       |
   *                  |   | delay 1..3s           |
   *                  |   +---------------|-------+
   *                  |                   |
   *                  |   source=b.m3u8   |
   *                  |   playback=hls.js |
   *                  +-------------------+
   *
   * As can be seen from the diagram, the plugin will endless try to load the next sources rotating between them in round-robin manner.
   */
  private sourcesList: PlayerMediaSourceDesc[] = []

  private currentSourceIndex = 0

  private sourcesDelay: Record<string, number> = {}

  private active = false

  private autoPlay = false

  private switching = false

  private sync: SyncFn = noSync

  /**
   * @internal
   */
  get name() {
    return 'source_controller'
  }

  /**
   * @internal
   */
  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  /**
   * @param core - The Clappr core instance.
   */
  constructor(core: ClapprCore) {
    super(core)
    this.sourcesList = this.core.options.sources
    if (this.core.options.source !== undefined) {
      // prevent Clappr from loading all sources simultaneously
      this.core.options.sources = [this.core.options.source]
      this.core.options.source = undefined // TODO test
    } else {
      this.core.options.sources = this.core.options.sources.slice(0, 1)
    }
  }

  /**
   * Set new media source.
   *
   * @param sourcesList - The list of new media source URLs
   * @beta
   * @remarks
   * Triggers a reload of the playback module, container and all container plugins.
   */
  setMediaSource(sourcesList: PlayerMediaSourceDesc[]) {
    trace('setMediaSource', {
      sourcesList,
    })
    this.sourcesList = sourcesList
    this.core.load(sourcesList, this.core.options.mimeType)
  }

  /**
   * @internal
   */
  override bindEvents() {
    super.bindEvents()

    this.listenTo(this.core, Events.CORE_READY, this.onCoreReady)
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.onActiveContainerChanged,
    )
  }

  private onCoreReady() {
    this.core.getPlugin('error_screen')?.disable() //  TODO test
  }

  private onActiveContainerChanged() {
    const spinner = this.core.activeContainer?.getPlugin('spinner')
    if (spinner) {
      this.sync = (cb: () => void) => {
        spinner.once(SpinnerEvents.SYNC, cb)
      }
    } else {
      this.sync = noSync
    }
    this.bindContainerEventListeners()
    if (this.active) {
      this.core.activeContainer?.getPlugin('poster')?.disable()
      spinner?.show(0)
    }
  }

  private bindContainerEventListeners() {
    this.core.activePlayback.on(
      Events.PLAYBACK_ERROR,
      (error: PlaybackError) => {
        trace(`${T} on PLAYBACK_ERROR`, {
          error: {
            code: error?.code,
            description: error?.description,
            level: error?.level,
          },
          switching: this.switching,
          retrying: this.active,
          currentSource: this.sourcesList[this.currentSourceIndex],
        })
        if (this.switching) {
          return
        }
        // The autoPlay metadata flag is set between a call to play and the actual playback start event, after which the flag is cleared.
        this.autoPlay =
          !!this.core.activeContainer.actionsMetadata.playEvent?.autoPlay
        switch (error.code) {
          case PlaybackErrorCode.MediaSourceUnavailable:
            this.core.activeContainer?.getPlugin('poster')?.disable()
            this.retryPlayback()
            break
          default:
            break
        }
      },
    )
    this.listenTo(
      this.core.activeContainer,
      Events.CONTAINER_PLAY,
      (_: string, { autoPlay }: { autoPlay?: boolean }) => {
        trace(`${T} onContainerPlay`, {
          autoPlay,
          currentSource: this.sourcesList[this.currentSourceIndex],
          retrying: this.active,
        })
        this.autoPlay = !!autoPlay
        if (this.active) {
          this.reset()
          this.core.activeContainer?.getPlugin('poster')?.enable()
          this.core.activeContainer?.getPlugin('spinner')?.hide()
        }
      },
    )
  }

  private reset() {
    this.active = false
    this.sourcesDelay = {}
  }

  private retryPlayback() {
    trace(`${T} retryPlayback enter`, {
      currentSourceIndex: this.currentSourceIndex,
      currentSource: this.sourcesList[this.currentSourceIndex],
    })
    this.active = true
    this.switching = true
    this.core.activeContainer?.getPlugin('spinner')?.show(0)
    this.getNextMediaSource().then((nextSource: PlayerMediaSourceDesc) => {
      trace(`${T} retryPlayback syncing...`, {
        nextSource,
      })
      const rnd = Math.round(RETRY_DELAY_BLUR * Math.random())
      this.sync(() => {
        this.switching = false
        this.core.load(nextSource.source, nextSource.mimeType)
        trace(`${T} retryPlayback loaded`, {
          nextSource,
        })
        setTimeout(() => {
          trace(`${T} retryPlayback playing`, {
            autoPlay: this.autoPlay,
            nextSource,
          })
          this.core.activeContainer.play({
            autoPlay: this.autoPlay,
          })
        }, rnd)
      })
    })
  }

  private getNextMediaSource(): Promise<PlayerMediaSourceDesc> {
    return new Promise((resolve) => {
      this.sourcesDelay[this.currentSourceIndex] = Math.min(
        MAX_RETRY_DELAY,
        (this.sourcesDelay[this.currentSourceIndex] || INITIAL_RETRY_DELAY) * 2,
      )
      this.currentSourceIndex =
        (this.currentSourceIndex + 1) % this.sourcesList.length
      const delay =
        this.sourcesDelay[this.currentSourceIndex] || INITIAL_RETRY_DELAY
      const s = this.sourcesList[this.currentSourceIndex]
      setTimeout(() => resolve(s), delay)
    })
  }

  /**
   * @internal
   */
  static get version() {
    return VERSION
  }
}
