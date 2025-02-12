import EventLite from 'event-lite'

/**
 * @internal
 */
export class _MockPlayback extends EventLite {
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
