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

export function createMockCore(options: Record<string, unknown> = {}, container: any = createMockContainer()) {
  const el = document.createElement('div')
  return Object.assign(new Events(), {
    el,
    $el: {
      [0]: el,
      append: vi.fn(),
    },
    activePlayback: container.playback,
    activeContainer: container,
    options: {
      ...options,
    },
    configure: vi.fn(),
    getPlugin: vi.fn(),
    load: vi.fn(),
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
  return Object.assign(new Events(), {
    $el: {
      html: vi.fn(),
      [0]: el,
    },
    el,
    getPlugin: vi.fn(),
    playback,
  })
}
