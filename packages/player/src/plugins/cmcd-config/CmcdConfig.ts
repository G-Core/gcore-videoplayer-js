import {
  Core,
  CorePlugin,
  Events,
} from '@clappr/core'

import { generateContentId, generateSessionId } from './utils'

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
   * Content ID, either constant or derived from current source.
   * If ommitted, a SHA-1 hash of current source URL will be used
   */
  contentId?: string | ((sourceUrl: string, mimeType?: string) => (string | Promise<string>))
}

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

  constructor(core: Core) {
    super(core)
    this.sid = this.options.cmcd?.sessionId ?? generateSessionId()
  }

  /**
   * @inheritdocs
   */
  override bindEvents() {
    this.listenTo(this.core, Events.CORE_ACTIVE_CONTAINER_CHANGED, () =>
      this.updateSettings(),
    )
  }

  async getIds(): Promise<{ sid: string; cid: string }> {
    return {
      sid: this.sid,
      cid: await this.ensureContentId(),
    }
  }

  private updateSettings() {
    switch (this.core.activeContainer.playback.name) {
      case 'dash':
        this.updateDashjsSettings()
        break
      case 'hls':
        this.updateHlsjsSettings()
        break
    }
  }

  private async updateDashjsSettings() {
    const {cid, sid} = await this.getIds()
    const options = this.core.activePlayback.options
    this.core.activePlayback.options = {
      ...options,
      dash: {
        ...(options.dash ?? {}),
        cmcd: {
          enabled: true,
          enabledKeys: CMCD_KEYS,
          sid,
          cid,
        },
      },
    }
  }

  private async updateHlsjsSettings() {
    const { cid, sid } = await this.getIds()
    const options = this.core.activePlayback.options
    this.core.activePlayback.options = {
      ...options,
      playback: {
        hlsjsConfig: {
          ...(options.playback?.hlsjsConfig ?? {}),
          cmcd: {
            includeKeys: CMCD_KEYS,
            sessionId: sid,
            contentId: cid,
          },
        },
      },
    }
  }

  private async ensureContentId(): Promise<string> {
    if (!this.cid) {
      this.cid = await this.evalContentId()
    }
    return this.cid
  }

  private async evalContentId(): Promise<string> {
    if (!this.core.activeContainer.options.cmcd?.contentId) {
      return generateContentId(this.core.activePlayback.options.src)
    }
    const contentId = this.core.activeContainer.options.cmcd.contentId
    if (typeof contentId === 'string') {
      return contentId
    }
    return Promise.resolve(contentId(this.core.activePlayback.options.src))
  }
}
