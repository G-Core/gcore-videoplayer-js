import { $, Container, Core, CorePlugin, Events } from '@clappr/core'

// import { trace } from '@gcorevideo/utils'

import { generateSessionId } from './utils'
import { CLAPPR_VERSION } from '../../build.js'
import { CoreOptions } from 'src/internal.types'

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
 * @beta
 */
export type CmcdConfigPluginSettings = {
  /**
   * Session ID. If ommitted, a random UUID will be generated
   */
  sessionId: string
  /**
   * Content ID,
   * If ommitted, the pathname part of the first source URL will be used
   */
  contentId?: string
}

// const T = 'plugins.cmcd'

/**
 * A `PLUGIN` that configures CMCD for playback
 * @beta
 * @remarks
 * Configuration options
 *   `cmcd`: {@link CmcdConfigPluginSettings}
 */
export class CmcdConfig extends CorePlugin {
  private sid: string

  private cid = ''

  /**
   * @inheritdocs
   */
  get name() {
    return 'cmcd'
  }

  get version() {
    return '0.1.0'
  }

  get supportedVersion() {
    return CLAPPR_VERSION
  }

  constructor(core: Core) {
    super(core)
    this.sid = this.options.cmcd?.sessionId ?? generateSessionId()
    this.cid = this.options.cmcd?.contentId ?? this.generateContentId()
  }

  /**
   * @inheritdocs
   */
  override bindEvents() {
    this.listenTo(this.core, Events.CORE_CONTAINERS_CREATED, () =>
      this.updateSettings(this.core.containers[0]),
    )
  }

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
            cmcd: {
              enabled: true,
              enabledKeys: CMCD_KEYS,
              sid: this.sid,
              cid: this.cid,
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

  private updateHlsjsSettings(
    options: CoreOptions,
    { cid, sid }: { cid: string; sid: string },
  ) {
    $.extend(true, options, {
      playback: {
        hlsjsConfig: {
          cmcd: {
            includeKeys: CMCD_KEYS,
            sessionId: sid,
            contentId: cid,
          },
        },
      },
    })
  }

  private generateContentId() {
    return new URL(
      this.core.options.source ?? this.core.options.sources[0].source,
    ).pathname.slice(0, 64)
  }
}
