import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import EventLite from 'event-lite'
import FakeTimers from '@sinonjs/fake-timers'

import { SourceController } from '../SourceController'
import { _MockPlayback, PlaybackErrorCode } from '@gcorevideo/player'

const MOCK_SOURCES = [
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
]

describe('SourceController', () => {
  let clock: ReturnType<typeof FakeTimers.install>
  beforeEach(() => {
    clock = FakeTimers.install()
  })
  afterEach(() => {
    clock.uninstall()
  })
  describe('init', () => {
    let core: any
    describe.each([
      [
        'list of sources with a selected source',
        {
          sources: MOCK_SOURCES,
          source: 'http://0eab.cdn.globo.com/1932-1447.mpd',
        },
        { sources: ['http://0eab.cdn.globo.com/1932-1447.mpd'] },
      ],
      [
        'list of sources without a selected source',
        {
          sources: MOCK_SOURCES,
          source: undefined,
        },
        {
          sources: [
            {
              source: 'http://0eab.cdn.globo.com/1932-1447.mpd',
              mimeType: 'application/dash+xml',
            },
          ],
        },
      ],
    ])('%s', (_, inputSourcesConfig, correctedSourcesConfig) => {
      it('should keep a single source for the core', () => {
        core = createMockCore(inputSourcesConfig)
        const _ = new SourceController(core)
        expect(core.options).toEqual(expect.objectContaining(correctedSourcesConfig))
      })
    })
  })
  describe('on fatal playback failure', () => {
    let core: any
    let nextPlayback: any

    describe('basically', () => {
      beforeEach(() => {
        core = createMockCore({
          sources: MOCK_SOURCES,
        })
        const _ = new SourceController(core)
        core.emit('core:ready')
        core.activePlayback.emit('playback:error', { code: PlaybackErrorCode.MediaSourceUnavailable })
        nextPlayback =  new _MockPlayback({} as any, {} as any)
        vi.spyOn(nextPlayback, 'consent')
        vi.spyOn(nextPlayback, 'play')
        core.activePlayback = nextPlayback
      })
      it('should load the next source after a delay', async () => {
        expect(core.load).not.toHaveBeenCalled()
        await clock.tickAsync(1000)
        expect(core.load).toHaveBeenCalledWith(MOCK_SOURCES[1].source, MOCK_SOURCES[1].mimeType)
      })
      it('should try to play after loading the source in a random delay', async () => {
        await clock.tickAsync(1000)
        expect(nextPlayback.play).not.toHaveBeenCalled()
        await clock.tickAsync(500) // TODO check randomness
        expect(nextPlayback.play).toHaveBeenCalled()
      })
      it('should not call consent', async () => {
        await clock.tickAsync(1500)
        expect(nextPlayback.consent).not.toHaveBeenCalled()
      })
      describe('after reinitializing the core', () => {
        let poster: any
        let spinner: any
        beforeEach(async () => {
          poster = createMockPlugin()
          spinner = createSpinnerPlugin()
          core.activeContainer.getPlugin.mockImplementation((name: string) => {
            if (name === 'poster_custom') {
              return poster
            }
            if (name === 'spinner') {
              return spinner
            }
          })
          core.emit('core:ready')
        })
        it('should disable the poster', async () => {
          expect(poster.disable).toHaveBeenCalled()
        })
        it('should show the spinner', async () => {
          expect(spinner.show).toHaveBeenCalled()
        })
      })
    })
    describe('if the spinner plugin is present', () => {
      let spinner: any
      beforeEach(() => {
        core = createMockCore({
          sources: MOCK_SOURCES,
        })
        spinner = createSpinnerPlugin()
        core.activeContainer.getPlugin.mockImplementation((name: string) => {
          if (name === 'spinner') {
            return spinner
          }
        })
        const _ = new SourceController(core)
        core.emit('core:ready')
        core.activePlayback.emit('playback:error', { code: PlaybackErrorCode.MediaSourceUnavailable })
        nextPlayback =  new _MockPlayback({} as any, {} as any)
        vi.spyOn(nextPlayback, 'consent')
        vi.spyOn(nextPlayback, 'play')
        core.activePlayback = nextPlayback
      })
      it('should sync with the spinner before reloading the source', async () => {
        await clock.tickAsync(1000)
        expect(core.load).not.toHaveBeenCalled()
        spinner.emit('spinner:sync')
        expect(core.load).toHaveBeenCalled()
      })
    })
    describe('after recovery', () => {
      // TODO
      let poster: any
      let spinner: any
      beforeEach(async () => {
        core = createMockCore({
          sources: MOCK_SOURCES,
        })
        const _ = new SourceController(core)
        core.emit('core:ready')
        core.activePlayback.emit('playback:error', { code: PlaybackErrorCode.MediaSourceUnavailable })
        await clock.tickAsync(1000)
        nextPlayback =  new _MockPlayback({} as any, {} as any)
        core.activePlayback = nextPlayback
        poster = createMockPlugin()
        spinner = createSpinnerPlugin()
        core.activeContainer.getPlugin.mockImplementation((name: string) => {
          if (name === 'poster_custom') {
            return poster
          }
          if (name === 'spinner') {
            return spinner
          }
        })
        core.emit('core:ready')
        nextPlayback.emit('playback:play')
      })
      it('should enable the poster', async () => {
        expect(poster.enable).toHaveBeenCalled()
      })
      it('should hide the spinner', async () => {
        expect(spinner.hide).toHaveBeenCalled()
      })
      describe.each([
        [
          'buffering',
          'playback:buffering',
        ],
        [
          'pause',
          'playback:pause',
        ],
      ])('on a following playback:play event due to %s', (_, event) => {
        it('should do nothing', async () => {
          nextPlayback.emit(event)
          await clock.tickAsync(1000)
          nextPlayback.emit('playback:play')
          await clock.tickAsync(1000)
          expect(poster.enable).toHaveBeenCalledTimes(1)
          expect(spinner.hide).toHaveBeenCalledTimes(1)
        })
      })
    })
  })
})

function createMockCore(options: Record<string, unknown> = {}) {
  return Object.assign(new EventLite(), {
    activePlayback: new _MockPlayback({} as any, {} as any),
    activeContainer: Object.assign(new EventLite(), {
      getPlugin: vi.fn(),
    }),
    options: {
      ...options,
    },
    load: vi.fn(),
  })
}

function createMockPlugin() {
  return Object.assign(new EventLite(), {
    enable: vi.fn(),
    disable: vi.fn(),
  })
}

function createSpinnerPlugin() {
  return Object.assign(createMockPlugin(), {
    show: vi.fn(),
    hide: vi.fn(),
  })
}
