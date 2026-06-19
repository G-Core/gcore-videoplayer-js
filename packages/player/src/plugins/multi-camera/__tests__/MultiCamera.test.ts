import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Events } from '@clappr/core'

import { MultiCamera } from '../MultiCamera'
import { createMockCore, createMockMediaControl } from '../../../testUtils'

function setup(multisources: any[], multisourcesMode = 'show_all') {
  const core: any = createMockCore({ multisources, multisourcesMode })
  const mediaControl = createMockMediaControl(core)
  core.mediaControl = mediaControl
  core.getPlugin = vi.fn().mockImplementation((name: string) => {
    if (name === 'media_control') return mediaControl
    return null
  })
  // The base UICorePlugin constructor calls render() before fields are set; in
  // production the activeContainer guard short-circuits it because the plugin
  // is constructed before the container is ready. Reproduce that ordering.
  const container = core.activeContainer
  const playback = core.activePlayback
  core.activeContainer = null
  core.activePlayback = null
  const plugin = new MultiCamera(core)
  core.activeContainer = container
  core.activePlayback = playback
  core.emit(Events.CORE_READY)
  mediaControl.trigger(Events.MEDIACONTROL_RENDERED)
  return { core, mediaControl, plugin }
}

describe('MultiCamera', () => {
  describe('XSS: malicious stream metadata from a remote source list', () => {
    const TITLE_PAYLOAD = '<img src=x onerror=__xss_title__()>'
    const DESC_PAYLOAD = '<img src=x onerror=__xss_desc__()>'
    const SCREENSHOT_PAYLOAD = '"><img src=x onerror=__xss_ss__()>'
    const ID_PAYLOAD = '"><img src=x onerror=__xss_id__()>'

    let plugin: MultiCamera
    beforeEach(() => {
      const multisources = [
        {
          id: 1,
          live: true,
          title: 'Camera 1',
          description: 'A safe camera',
          screenshot: 'https://example.com/a.jpg',
          source: 'https://example.com/a.m3u8',
          source_dash: null,
          hls_mpegts_url: null,
          projection: null,
          dvr: false,
        },
        {
          id: ID_PAYLOAD,
          live: true,
          title: TITLE_PAYLOAD,
          description: DESC_PAYLOAD,
          screenshot: SCREENSHOT_PAYLOAD,
          source: 'https://example.com/b.m3u8',
          source_dash: null,
          hls_mpegts_url: null,
          projection: null,
          dvr: false,
        },
      ]
      ;({ plugin } = setup(multisources))
    })

    it('should not inject an element with an event handler', () => {
      expect(plugin.el.querySelectorAll('[onerror]').length).toBe(0)
    })
    it('should render exactly one screenshot image per stream', () => {
      // Each stream renders one legitimate <img>; a breakout would create extra.
      expect(plugin.el.querySelectorAll('img').length).toBe(2)
    })
    it('should keep a malicious screenshot url confined to the src attribute', () => {
      const imgs = plugin.$el.find('img')
      expect(imgs.eq(1).attr('src')).toBe(SCREENSHOT_PAYLOAD)
    })
    it('should render a stream title as literal text', () => {
      expect(plugin.$el.find('.multicamera-title').text()).toContain(
        TITLE_PAYLOAD,
      )
    })
    it('should render a stream description as literal text', () => {
      expect(plugin.$el.find('.multicamera-description').text()).toContain(
        DESC_PAYLOAD,
      )
    })
    it('should keep a malicious stream id confined to its attribute value', () => {
      const items = plugin.$el.find('.multicamera-item')
      expect(items.eq(1).attr('data-multicamera-selector-select')).toBe(
        ID_PAYLOAD,
      )
    })
  })
})
