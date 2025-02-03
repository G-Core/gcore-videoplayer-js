import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockedObject,
  vi,
} from 'vitest'
import FakeTimers from '@sinonjs/fake-timers'
import { LogTracer, Logger, setTracer } from '@gcorevideo/utils'
import { Loader, Player as PlayerClappr } from '@clappr/core'
import EventLite from 'event-lite'

import { Player } from '../Player'
import { TransportPreference } from '../types'
import { canPlayDash, canPlayHls } from '../playback'
import { PlaybackErrorCode } from '../playback.types'
import { isDashSource, isHlsSource } from '../utils/testUtils'

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
      registeredPlaybacks: [],
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
  beforeEach(() => {
    vi.mocked(Loader).registeredPlaybacks = [
      new MockDashPlayback({} as any, {} as any),
      new MockHlsPlayback({} as any, {} as any),
      new MockHTML5VideoPlayback({} as any, {} as any),
    ]
  })
  describe('selecting media source', () => {
    describe.each([
      ['dash', true, true, 'http://0eab.cdn.globo.com/1932-1447.mpd'],
      ['dash', false, true, 'http://0eab.cdn.globo.com/1932-1447.m3u8'],
      ['dash', false, false, undefined],
      ['hls', true, true, 'http://0eab.cdn.globo.com/1932-1447.m3u8'],
      ['hls', true, false, 'http://0eab.cdn.globo.com/1932-1447.mpd'],
      ['hls', false, false, undefined],
    ])(
      ' according to the preference (%s) and capabilities (dash=%s, hls=%s)',
      (priority, dash, hls, source: string | undefined) => {
        beforeEach(() => {
          if (dash === false) {
            vi.mocked(canPlayDash).mockReturnValue(false)
          }
          if (hls === false) {
            vi.mocked(canPlayHls).mockReturnValue(false)
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
                mimeType: 'application/mpegts',
              },
            ],
          })
          const node = document.createElement('div')
          player.attachTo(node)
        })
        afterEach(() => {
          vi.mocked(canPlayDash).mockImplementation((source, mimeType) =>
            isDashSource(source, mimeType),
          )
          vi.mocked(canPlayHls).mockImplementation((source, mimeType) =>
            isHlsSource(source, mimeType),
          )
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

class MockDashPlayback extends MockPlayback {
  get name() {
    return 'dash'
  }
}

class MockHlsPlayback extends MockPlayback {
  get name() {
    return 'hls'
  }
}

class MockHTML5VideoPlayback extends MockPlayback {
  get name() {
    return 'html5_video'
  }
}
