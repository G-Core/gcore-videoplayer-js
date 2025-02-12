import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockedObject,
  vi,
} from 'vitest'
import { LogTracer, setTracer } from '@gcorevideo/utils'
import { Loader, Player as PlayerClappr } from '@clappr/core'
import EventLite from 'event-lite'

import { Player } from '../Player'
import { TransportPreference } from '../types'
import { canPlayDash, canPlayHls } from '../playback'
import { isDashSource, isHlsSource } from '../utils/mediaSources'

function createMockClapprPlayer(): MockedObject<typeof PlayerClappr> {
  return {
    core: Object.assign(new EventLite(), {
      activeContainer: null,
      activePlayback: null,
      load: vi.fn(),
      resize: vi.fn(),
      trigger(event: string, ...args: any[]) {
        this.emit(event, ...args)
      },
    }),
    attachTo: vi.fn(),
  } as any
}
vi.mock('@clappr/core', async () => {
  const imported = await import('@clappr/core')
  const MockDashPlayback = {
    _supported: true,
    prototype: {
      name: 'dash',
    },
    canPlay(source, mimeType) {
      return this._supported && (mimeType === 'application/dash+xml' || source.endsWith('.mpd'))
    },
  }
  const MockHlsPlayback = {
    _supported: true,
    prototype: {
      name: 'hls',
    },
    canPlay(source, mimeType) {
      return this._supported && (['application/vnd.apple.mpegurl', 'application/x-mpegurl'].includes(mimeType) || source.endsWith('.m3u8'))
    },
  }
  const MockHTML5VideoPlayback = {
    _supported: true,
    prototype: {
      name: 'html5_video',
    },
    canPlay(source, mimeType) {
      return this._supported && ['video/mp4', 'application/vnd.apple.mpegurl'].includes(mimeType)
    },
  }
  return {
    $: {
      extend: vi.fn().mockImplementation((v, ...objs) => {
        if (v !== true) {
          objs.unshift(v)
        }
        return objs.reduce((acc, obj) => ({ ...acc, ...obj }), {})
      }),
    },
    Browser: {
      isiOS: false,
    },
    Events: imported.Events,
    Loader: {
      registerPlugin: vi.fn(),
      registeredPlaybacks: [MockDashPlayback, MockHlsPlayback, MockHTML5VideoPlayback],
      registeredPlugins: { core: [], container: [] },
      unregisterPlugin: vi.fn(),
    },
    Player: vi.fn().mockImplementation(createMockClapprPlayer),
    Utils: {
      now: vi.fn().mockReturnValue(150),
    },
  }
})

vi.mock('../playback/index.ts', () => ({
  registerPlaybacks: vi.fn(),
  canPlayDash: vi.fn(),
  canPlayHls: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(PlayerClappr).mockClear()
  setTracer(new LogTracer('Player.test.js'))
  vi.mocked(canPlayDash)
    .mockReset()
    .mockImplementation((source, mimeType) => isDashSource(source, mimeType))
  vi.mocked(canPlayHls)
    .mockReset()
    .mockImplementation((source, mimeType) => isHlsSource(source, mimeType))
})

describe('Player', () => {
  describe('selecting media source', () => {
    describe.each([
      ['dash', true, true, 'http://0eab.cdn.globo.com/1932-1447.mpd'],
      ['dash', false, true, 'http://0eab.cdn.globo.com/1932-1447.m3u8'],
      ['dash', false, false, 'http://0eab.cdn.globo.com/1932-1447.m3u8'],
      ['hls', true, true, 'http://0eab.cdn.globo.com/1932-1447.m3u8'],
      ['hls', true, false, 'http://0eab.cdn.globo.com/1932-1447.mpd'],
      ['hls', false, false, 'http://0eab.cdn.globo.com/1932-1447.m3u8'],
    ])(
      ' according to the preference (%s) and capabilities (dash=%s, hls=%s)',
      (priority, dash, hls, source: string | undefined) => {
        beforeEach(() => {
          if (dash === false) {
            Loader.registeredPlaybacks[0]._supported = false
          }
          if (hls === false) {
            Loader.registeredPlaybacks[1]._supported = false
          }
          const player = new Player({
            priorityTransport: priority as TransportPreference | undefined,
            sources: [
              { source: 'http://0eab.cdn.globo.com/1932-1447.mpd' },
              {
                source: 'http://0eab.cdn.globo.com/1932-1447.m3u8',
                mimeType: 'application/vnd.apple.mpegurl',
              },
              {
                source: 'http://0eab.cdn.globo.com/1932-1447_mpegts.m3u8',
                mimeType: 'application/vnd.apple.mpegurl',
              },
            ],
          })
          const node = document.createElement('div')
          player.attachTo(node)
        })
        afterEach(() => {
          Loader.registeredPlaybacks[0]._supported = true
          Loader.registeredPlaybacks[1]._supported = true
        })
        it('should select the first supported available source', () => {
          expect(PlayerClappr).toHaveBeenCalledWith(
            expect.objectContaining({
              source,
            }),
          )
        })
      },
    )
  })
})

class MockPlayback extends EventLite {
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
