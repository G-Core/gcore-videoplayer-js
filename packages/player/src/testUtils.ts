import { $, UICorePlugin } from '@clappr/core'
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
    return 'live'
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
    levels: [],
    consent() {},
    play() {},
    pause() {},
    stop() {},
    destroy() {},
    seek() {},
    seekPercentage() {},
    getDuration() {
      return 100
    },
    enterPiP() {},
    exitPiP() {},
    getPlaybackType() {
      return 'live'
    },
    getStartTimeOffset() {
      return 0
    },
    getCurrentTime() {
      return 0
    },
    isHighDefinitionInUse() {
      return false
    },
    mute() {},
    unmute() {},
    volume() {},
    configure() {},
    attemptAutoPlay() {
      return true
    },
    canAutoPlay() {
      return true
    },
    onResize() {
      return true
    },
    trigger(event: string, ...args: any[]) {
      emitter.emit(event, ...args)
    },
  })
}

export function createMockContainer(playback: any = createMockPlayback()) {
  const el = document.createElement('div')
  const emitter = new Events()
  return Object.assign(emitter, {
    el,
    playback,
    $el: $(el),
    getDuration: vi.fn().mockReturnValue(0),
    getPlugin: vi.fn(),
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
  mediaControl.getLeftPanel = vi.fn().mockImplementation(() => mediaControl.$el.find('.media-control-left-panel'))
  // @ts-ignore
  mediaControl.getRightPanel = vi.fn().mockImplementation(() => mediaControl.$el.find('.media-control-right-panel'))
  // @ts-ignore
  mediaControl.getCenterPanel = vi.fn().mockImplementation(() => mediaControl.$el.find('.media-control-center-panel'))
  return mediaControl
}
