import { $, UICorePlugin } from '@clappr/core'
import Events from 'eventemitter3'
import { vi } from 'vitest'

export function createMockCore(
  options: Record<string, unknown> = {},
  container: any = createMockContainer(options),
) {
  const el = document.createElement('div')
  const emitter = new Events()
  return Object.assign(emitter, {
    el,
    $el: $(el),
    activePlayback: container.playback,
    activeContainer: container,
    i18n: {
      t: vi.fn().mockImplementation((key: string) => key),
    },
    options: {
      ...options,
    },
    configure: vi.fn(),
    getPlaybackType: vi.fn(),
    getPlugin: vi.fn(),
    load: vi.fn(),
    trigger: emitter.emit,
  })
}

export function createMockPlugin() {
  return Object.assign(new Events(), {
    enable: vi.fn(),
    disable: vi.fn(),
  })
}

export function createSpinnerPlugin() {
  return Object.assign(createMockPlugin(), {
    show: vi.fn(),
    hide: vi.fn(),
  })
}

export function createMockPlayback(name = 'mock') {
  const emitter = new Events()
  return Object.assign(emitter, {
    name,
    currentLevel: -1,
    el: document.createElement('video'),
    dvrEnabled: false,
    dvrInUse: false,
    isAudioOnly: false,
    levels: [],
    consent: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    seek: vi.fn(),
    seekPercentage: vi.fn(),
    getDuration: vi.fn().mockImplementation(() => 100),
    enterPiP: vi.fn(),
    exitPiP: vi.fn(),
    getPlaybackType: vi.fn(),
    getStartTimeOffset: vi.fn().mockImplementation(() => 0),
    getCurrentTime: vi.fn().mockImplementation(() => 0),
    isHighDefinitionInUse: vi.fn().mockImplementation(() => false),
    mute: vi.fn(),
    unmute: vi.fn(),
    volume: vi.fn(),
    configure: vi.fn(),
    attemptAutoPlay: vi.fn().mockImplementation(() => true),
    canAutoPlay: vi.fn().mockImplementation(() => true),
    onResize: vi.fn().mockImplementation(() => true),
    setPlaybackRate: vi.fn(),
    switchAudioTrack: vi.fn(),
    trigger: emitter.emit,
  })
}

export function createMockContainer(
  options: Record<string, unknown> = {},
  playback: any = createMockPlayback(),
) {
  const el = playback.el
  const emitter = new Events()
  return Object.assign(emitter, {
    el,
    playback,
    options: {
      ...options,
    },
    $el: $(el),
    disableMediaControl: vi.fn(),
    enableMediaControl: vi.fn(),
    enterPiP: vi.fn(),
    exitPiP: vi.fn(),
    getDuration: vi.fn().mockReturnValue(0),
    getPlugin: vi.fn(),
    getPlaybackType: vi.fn(),
    getStartTimeOffset: vi.fn().mockReturnValue(0),
    isDvrInUse: vi.fn().mockReturnValue(false),
    isDvrEnabled: vi.fn().mockReturnValue(false),
    isHighDefinitionInUse: vi.fn().mockReturnValue(false),
    isPlaying: vi.fn().mockReturnValue(false),
    play: vi.fn(),
    seek: vi.fn(),
    seekPercentage: vi.fn(),
    switchAudioTrack: vi.fn(),
    trigger: emitter.emit,
  })
}

export function createMockMediaControl(core: any) {
  const mediaControl = new UICorePlugin(core)
  // TODO <div class="media-control-layer">
  mediaControl.$el.html(
    `<div class="media-control-left-panel" data-media-control></div>
    <div class="media-control-right-panel" data-media-control></div>
    <div class="media-control-center-panel" data-media-control></div>`,
  )
  // @ts-ignore
  mediaControl.mount = vi.fn()
  // @ts-ignore
  mediaControl.container = core.activeContainer
  // @ts-ignore
  mediaControl.toggleElement = vi.fn()
  vi.spyOn(mediaControl, 'trigger')
  core.$el.append(mediaControl.$el)
  return mediaControl
}

export function createMockBottomGear(core: any) {
  const plugin: any = new UICorePlugin(core)
  plugin.getItem = vi.fn()
  plugin.addItem = vi.fn().mockImplementation((name: string, $el: any) => {
    const existing = plugin.$el.find(`[data-${name}]`)
    if (existing.length) {
      return existing
    }
    return $('<li></li>')
      .attr(`data-${name}`, '')
      .append($el)
      .appendTo(plugin.$el)
  })
  plugin.refresh = vi.fn()
  return plugin
}
