import { $, Container, Core, CorePlugin, Events } from '@clappr/core'

// import { trace } from '@gcorevideo/utils'

import { generateSessionId } from './utils'
import { CLAPPR_VERSION } from '../../build.js'

const CMCD_KEYS = [
  'br',
  'd',
  'ot',
  'tb',
  'bl',
  'dl',
  'mtp',
  'nor',
  'nrr',
  'su',
  'bs',
  'rtp',
  'cid',
  'pr',
  'sf',
  'sid',
  'st',
  'v',
]

/**
 * Config options for the {@link CmcdConfig} plugin
 * @public
 */
export interface CmcdConfigOptions {
  /**
   * `sid` value. If ommitted, a random UUID will be generated
   */
  sessionId?: string
  /**
   * `cid` value.
   * If ommitted, the pathname part of the first source URL will be used
   */
  contentId?: string
}

// const T = 'plugins.cmcd'

/**
 * A `PLUGIN` that configures {@link https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf | CMCD} for playback
 * @public
 * @remarks
 * Configuration options - {@link CmcdConfigOptions}.
 * @example
 * ```ts
 * import { CmcdConfig } from '@gcorevideo/player'
 * Player.registerPlugin(CmcdConfig)
 *
 * const player = new Player({
 *   source: 'https://example.com/video.mp4',
 *   cmcd: {
 *     sessionId: '1234567890',
 *     contentId: 'f572d396fae9206628714fb2ce00f72e94f2258f',
 *   },
 * })
 * ```
 */
export class CmcdConfig extends CorePlugin {
  private sid: string

  private cid = ''

  /**
   * @internal
   */
  get name() {
    return 'cmcd'
  }

  /**
   * @internal
   */
  get version() {
    return '0.1.0'
  }

  /**
   * @internal
   */
  get supportedVersion() {
    return CLAPPR_VERSION
  }

  constructor(core: Core) {
    super(core)
    this.sid = this.options.cmcd?.sessionId ?? generateSessionId()
    this.setContentId()
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.core, Events.CORE_CONTAINERS_CREATED, () => {
      this.setContentId()
      this.updateSettings(this.core.containers[0])
    })
  }

  /**
   * Returns the current `sid` and `cid` values.
   * Useful when the auto-generated values need to be known.
   * @returns `sid` and `cid` values
   */
  exportIds(): { sid: string; cid: string } {
    return {
      sid: this.sid,
      cid: this.cid,
    }
  }

  private async updateSettings(container: Container) {
    switch (container.playback.name) {
      case 'dash':
        $.extend(true, container.playback.options, {
          dash: {
            streaming: {
              cmcd: {
                enabled: true,
                enabledKeys: CMCD_KEYS,
                sid: this.sid,
                cid: this.cid,
              },
            },
          },
        })
        break
      case 'hls':
        $.extend(true, container.playback.options, {
          playback: {
            hlsjsConfig: {
              cmcd: {
                includeKeys: CMCD_KEYS,
                sessionId: this.sid,
                contentId: this.cid,
              },
            },
          },
        })
        break
    }
  }

  private generateContentId() {
    return new URL(
      this.core.options.source ?? this.core.options.sources[0].source,
    ).pathname.slice(0, 64)
  }

  private setContentId() {
    this.cid = this.options.cmcd?.contentId ?? this.generateContentId()
  }
}
