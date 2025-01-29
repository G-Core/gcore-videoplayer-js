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
      [undefined, true, true, 'http://0eab.cdn.globo.com/1932-1447.mpd'],
      ['dash', true, true, 'http://0eab.cdn.globo.com/1932-1447.mpd'],
      ['dash', false, true, 'http://0eab.cdn.globo.com/1932-1447.m3u8'],
      ['dash', false, false, 'http://0eab.cdn.globo.com/1932-1447_mpegts.m3u8'],
      ['hls', true, true, 'http://0eab.cdn.globo.com/1932-1447.m3u8'],
      ['hls', true, false, 'http://0eab.cdn.globo.com/1932-1447.mpd'],
      ['hls', false, false, 'http://0eab.cdn.globo.com/1932-1447_mpegts.m3u8'],
      ['mpegts', true, true, 'http://0eab.cdn.globo.com/1932-1447_mpegts.m3u8'],
      ['auto', true, true, 'http://0eab.cdn.globo.com/1932-1447.mpd'],
      ['auto', true, false, 'http://0eab.cdn.globo.com/1932-1447.mpd'],
      ['auto', false, true, 'http://0eab.cdn.globo.com/1932-1447.m3u8'],
      ['auto', false, false, 'http://0eab.cdn.globo.com/1932-1447_mpegts.m3u8'],
    ])(
      ' according to the preference (%s) and capabilities (dash=%s, hls=%s)',
      (priority, dash, hls, source: string) => {
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
  describe('on media source failure', () => {
    let player: Player
    let clappr: any
    let clock: ReturnType<typeof FakeTimers.install>
    beforeEach(async () => {
      Logger.enable('*')
      clock = FakeTimers.install()
      vi.mocked(Loader).registeredPlaybacks = [
        MockDashPlayback,
        MockHlsPlayback,
        MockHTML5VideoPlayback,
      ]
      clappr = createMockClapprPlayer() as any
      const playback = new MockDashPlayback({} as any, {} as any)
      clappr.core.activePlayback = playback
      vi.mocked(PlayerClappr).mockReturnValue(clappr as any)
      player = new Player({
        sources: [
          {
            source: 'http://0eab.cdn.globo.com/1932-1447.mpd',
            mimeType: 'application/dash+xml',
          },
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
      await clock.tickAsync(4000)
      playback.trigger('playback:error', {
        code: PlaybackErrorCode.MediaSourceUnavailable, // TODO rename to MediaSourceUnavailable
        message: 'Failed to download http://0eab.cdn.globo.com/1932-1447.mpd',
      })
    })
    afterEach(() => {
      clock.uninstall()
      Logger.enable('')
    })
    it('should try the next sources with a short delay', async () => {
      await clock.tickAsync(400) // 250 initial + random jitter up to 150
      expect(clappr.core.load).toHaveBeenCalledWith(
        'http://0eab.cdn.globo.com/1932-1447.m3u8',
        'application/vnd.apple.mpegurl',
      )

      const playback = new MockHlsPlayback({} as any, {} as any)
      clappr.core.activePlayback = playback
      clappr.core.trigger('core:active:container:changed', {})
      await clock.tickAsync(300)
      clappr.core.load.mockClear()
      playback.trigger('playback:error', {
        code: PlaybackErrorCode.MediaSourceUnavailable,
        message: 'Failed to download http://0eab.cdn.globo.com/1932-1447.m3u8',
      })
      await clock.tickAsync(400)
      expect(clappr.core.load).toHaveBeenCalledWith(
        'http://0eab.cdn.globo.com/1932-1447_mpegts.m3u8',
        'application/mpegts',
      )
    })
    describe('when rolled over to the first source', () => {
      beforeEach(async () => {
        await clock.tickAsync(400) // 250 initial + random jitter up to 150
        const playback = new MockHlsPlayback({} as any, {} as any)
        clappr.core.activePlayback = playback
        clappr.core.trigger('core:active:container:changed', {})
        await clock.tickAsync(300)
        playback.trigger('playback:error', {
          code: PlaybackErrorCode.MediaSourceUnavailable,
          message:
            'Failed to download http://0eab.cdn.globo.com/1932-1447.m3u8',
        })
        await clock.tickAsync(400)
        clappr.core.load.mockClear()
      })
      afterEach(() => {
        // Logger.enable('')
      })
      it('should start increasing the delay exponentially', async () => {
        const playback = new MockHlsPlayback({} as any, {} as any) // mpegts
        clappr.core.activePlayback = playback
        clappr.core.trigger('core:active:container:changed', {})
        await clock.tickAsync(300)
        playback.trigger('playback:error', {
          code: PlaybackErrorCode.MediaSourceUnavailable,
          message:
            'Failed to download http://0eab.cdn.globo.com/1932-1447_mpegts.m3u8',
        })
        await clock.tickAsync(400)
        expect(clappr.core.load).not.toHaveBeenCalledWith(
          'http://0eab.cdn.globo.com/1932-1447.mpd',
          'application/dash+xml',
        )
        await clock.tickAsync(250)
        expect(clappr.core.load).toHaveBeenCalledWith(
          'http://0eab.cdn.globo.com/1932-1447.mpd',
          'application/dash+xml',
        )
        // TODO
        clappr.core.load.mockClear()
        const p2 = new MockDashPlayback({} as any, {} as any)
        clappr.core.activePlayback = p2
        clappr.core.trigger('core:active:container:changed', {})
        await clock.tickAsync(300)
        p2.trigger('playback:error', {
          code: PlaybackErrorCode.MediaSourceUnavailable,
          message: 'Failed to download http://0eab.cdn.globo.com/1932-1447.mpd',
        })
        await clock.tickAsync(400)
        expect(clappr.core.load).not.toHaveBeenCalledWith(
          'http://0eab.cdn.globo.com/1932-1447.m3u8',
          'application/vnd.apple.mpegurl',
        )
        await clock.tickAsync(250)
        expect(clappr.core.load).toHaveBeenCalledWith(
          'http://0eab.cdn.globo.com/1932-1447.m3u8',
          'application/vnd.apple.mpegurl',
        )
      })
    })
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
