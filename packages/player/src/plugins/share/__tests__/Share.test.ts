import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Events } from '@clappr/core'

import { Share } from '../Share'
import { createMockCore, createMockMediaControl } from '../../../testUtils'

function setup(options: Record<string, unknown>) {
  const core: any = createMockCore(options)
  const mediaControl = createMockMediaControl(core)
  core.mediaControl = mediaControl
  core.getPlugin = vi.fn().mockImplementation((name: string) => {
    if (name === 'media_control') return mediaControl
    return null
  })
  const plugin = new Share(core)
  core.emit(Events.CORE_READY)
  mediaControl.trigger(Events.MEDIACONTROL_RENDERED)
  return { core, mediaControl, plugin }
}

describe('Share', () => {
  describe('XSS: malicious share url and embed code', () => {
    const URL_PAYLOAD = '"><img src=x onerror=__xss_url__()>'
    const EMBED_PAYLOAD = '</textarea><img src=x onerror=__xss_embed__()>'

    let plugin: Share
    beforeEach(() => {
      ;({ plugin } = setup({ shareURL: URL_PAYLOAD, embed: EMBED_PAYLOAD }))
    })

    it('should not inject an element with an event handler', () => {
      expect(plugin.el.querySelectorAll('[onerror]').length).toBe(0)
    })
    it('should not materialize any injected image element', () => {
      expect(plugin.el.querySelectorAll('img').length).toBe(0)
    })
    it('should keep the share url confined to the input value', () => {
      expect(plugin.$el.find('[data-share-link]').val()).toBe(URL_PAYLOAD)
    })
    it('should keep the embed code confined to the textarea value', () => {
      expect(plugin.$el.find('[data-share-embed]').val()).toBe(EMBED_PAYLOAD)
    })
  })
})
