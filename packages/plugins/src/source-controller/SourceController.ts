import {
  Events as ClapprEvents,
  CorePlugin,
  type Core as ClapprCore,
} from '@clappr/core'
import {
  type PlaybackError,
  PlaybackErrorCode,
  type PlayerMediaSourceDesc,
  trace,
} from '@gcorevideo/player'

import { CLAPPR_VERSION } from '../build'

const T = 'plugins.source_controller'

const INITIAL_RETRY_DELAY = 1000

const MAX_RETRY_DELAY = 5000

const RETRY_DELAY_BLUR = 500

const VERSION = '0.0.1'

type SyncFn = (cb: () => void) => void

function noSync(cb: () => void) {
  cb()
}

export class SourceController extends CorePlugin {
  private sourcesList: PlayerMediaSourceDesc[] = []

  private currentSourceIndex = 0

  private sourcesDelay: Record<string, number> = {}

  private retrying = false

  private sync: SyncFn = noSync

  get name() {
    return 'source_controller'
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  constructor(core: ClapprCore) {
    super(core)
    this.sourcesList = this.core.options.sources
    if (this.core.options.source !== undefined) {
      // prevent Clappr from loading all sources simultaneously
      this.core.options.sources = [this.core.options.source]
    } else {
      this.core.options.sources = this.core.options.sources.slice(0, 1)
    }
  }

  override bindEvents() {
    super.bindEvents()

    this.listenTo(this.core, ClapprEvents.CORE_READY, () => this.onReady())
  }

  private onReady() {
    trace(`${T} onReady`, {
      retrying: this.retrying,
    })
    const spinner = this.core.activeContainer?.getPlugin('spinner')
    if (spinner) {
      this.sync = (cb: () => void) => {
        spinner.once('spinner:sync', cb)
      }
    } else {
      this.sync = noSync
    }
    this.bindContainerEventListeners()
    if (this.retrying) {
      this.core.activeContainer?.getPlugin('poster_custom')?.disable()
      this.core.activeContainer?.getPlugin('spinner')?.show()
    }
  }

  private bindContainerEventListeners() {
    trace(`${T} bindContainerEventListeners`, {
      activePlayback: this.core.activePlayback?.name,
    })
    this.core.activePlayback.on(
      ClapprEvents.PLAYBACK_ERROR,
      (error: PlaybackError) => {
        trace(`${T} on PLAYBACK_ERROR`, {
          error,
          retrying: this.retrying,
        })
        switch (error.code) {
          case PlaybackErrorCode.MediaSourceUnavailable:
            this.retryPlayback()
            break
          // TODO handle other errors
          default:
            break
        }
      },
    )
    this.core.activePlayback.on(ClapprEvents.PLAYBACK_PLAY, () => {
      trace(`${T} on PLAYBACK_PLAY`)
      this.reset()
      // TODO make poster reset its state on enable
      this.core.activeContainer?.getPlugin('poster_custom')?.enable()
      this.core.activeContainer?.getPlugin('spinner')?.hide()
    })
  }

  private reset() {
    this.retrying = false
    this.sourcesDelay = {}
  }

  private retryPlayback() {
    trace(`${T} retryPlayback enter`, {
      currentSourceIndex: this.currentSourceIndex,
    })
    this.retrying = true
    this.getNextMediaSource().then((nextSource: PlayerMediaSourceDesc) => {
      trace(`${T} retryPlayback loading`, {
        nextSource,
      })
      const rnd = RETRY_DELAY_BLUR * Math.random()
      this.sync(() => {
        this.core.load(nextSource.source, nextSource.mimeType)
        trace(`${T} retryPlayback loaded`, {
          nextSource,
        })
        setTimeout(() => {
          this.core.activePlayback.consent()
          this.core.activePlayback.play()
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
      const delay = this.sourcesDelay[this.currentSourceIndex] || INITIAL_RETRY_DELAY
      const s = this.sourcesList[this.currentSourceIndex]
      setTimeout(() => resolve(s), delay)
    })
  }

  static get version() {
    return VERSION
  }
}
