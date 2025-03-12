import { $, Playback, UICorePlugin } from '@clappr/core'
import Events from 'eventemitter3'
import { vi } from 'vitest'
/**
 * @internal
 * @deprecated
 * TODO use createMockPlayback() instead
 */
export class _MockPlayback extends Events {
  constructor(
    protected options: any,
    readonly i18n: any,
    protected playerError?: any,
  ) {
    super()
  }

  get name() {
    return 'mock'
  }

  consent() {}

  play() {}

  pause() {}

  stop() {}

  destroy() {}

  seek() {}

  seekPercentage() {}

  getDuration() {
    return 100
  }

  enterPiP() {}

  exitPiP() {}

  getPlaybackType() {
    return Playback.LIVE
  }

  getStartTimeOffset() {
    return 0
  }

  getCurrentTime() {
    return 0
  }

  isHighDefinitionInUse() {
    return false
  }

  mute() {}

  unmute() {}

  volume() {}

  configure() {}

  attemptAutoPlay() {
    return true
  }

  canAutoPlay() {
    return true
  }

  onResize() {
    return true
  }

  trigger(event: string, ...args: any[]) {
    this.emit(event, ...args)
  }
}

export function createMockCore(
  options: Record<string, unknown> = {},
  container: any = createMockContainer(),
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
    getPlaybackType: vi.fn().mockReturnValue(Playback.LIVE),
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
    levels: [],
    consent() {},
    play() {},
    pause() {},
    stop() {},
    destroy: vi.fn(),
    seek: vi.fn(),
    seekPercentage: vi.fn(),
    getDuration: vi.fn().mockImplementation(() => 100),
    enterPiP: vi.fn(),
    exitPiP: vi.fn(),
    getPlaybackType: vi.fn().mockImplementation(() => Playback.LIVE),
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
    trigger: emitter.emit,
  })
}

export function createMockContainer(playback: any = createMockPlayback()) {
  const el = playback.el
  const emitter = new Events()
  return Object.assign(emitter, {
    el,
    playback,
    $el: $(el),
    getDuration: vi.fn().mockReturnValue(0),
    getPlugin: vi.fn(),
    getPlaybackType: vi.fn().mockReturnValue(Playback.LIVE),
    isDvrInUse: vi.fn().mockReturnValue(false),
    isDvrEnabled: vi.fn().mockReturnValue(false),
    isPlaying: vi.fn().mockReturnValue(false),
    play: vi.fn(),
    seek: vi.fn(),
    trigger: emitter.emit,
  })
}

export function createMockMediaControl(core: any) {
  const mediaControl = new UICorePlugin(core)
  mediaControl.$el.html(
    `<div class="media-control-left-panel" data-media-control></div>
    <div class="media-control-right-panel" data-media-control></div>
    <div class="media-control-center-panel" data-media-control></div>`,
  )
  const elements = {
    gear: $(document.createElement('div')),
  }
  // @ts-ignore
  mediaControl.getElement = vi.fn().mockImplementation((name) => elements[name])
  // @ts-ignore
  mediaControl.putElement = vi.fn()
  // @ts-ignore
  mediaControl.toggleElement = vi.fn()
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
    return $('<li></li>').attr(`data-${name}`, '').append($el).appendTo(plugin.$el)
  })
  plugin.refresh = vi.fn()
  return plugin
}
