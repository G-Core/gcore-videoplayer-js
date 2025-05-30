import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import FakeTimers from '@sinonjs/fake-timers'

import { SourceController } from '../SourceController'
import { PlaybackErrorCode } from '../../../playback.types.js'
import {
  createMockContainer,
  createMockCore,
  createMockPlayback,
  createMockPlugin,
  createSpinnerPlugin,
} from '../../../testUtils.js'
import { Events } from '@clappr/core'
import { SpinnerEvents } from '../../spinner-three-bounce/SpinnerThreeBounce.js'

// import { LogTracer, Logger, setTracer } from '@gcorevideo/utils'

// setTracer(new LogTracer('SourceController.test'))
// Logger.enable('*')

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
        expect(core.options).toEqual(
          expect.objectContaining(correctedSourcesConfig),
        )
      })
    })
  })
  describe('on fatal playback failure', () => {
    let core: any
    let nextPlayback: any
    let nextContainer: any
    describe('basically', () => {
      beforeEach(() => {
        core = createMockCore({
          sources: MOCK_SOURCES,
        })
        const _ = new SourceController(core)
        core.emit(Events.CORE_READY)
        core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED)
        core.activePlayback.emit(Events.PLAYBACK_ERROR, {
          code: PlaybackErrorCode.MediaSourceUnavailable,
        })
        nextContainer = createMockContainer()
        nextPlayback = nextContainer.playback
        core.activePlayback = nextPlayback
        core.activeContainer = nextContainer
      })
      it('should load the next source after a delay', async () => {
        expect(core.load).not.toHaveBeenCalled()
        await clock.tickAsync(1000)
        expect(core.load).toHaveBeenCalledWith(
          MOCK_SOURCES[1].source,
          MOCK_SOURCES[1].mimeType,
        )
      })
      it('should try to play after loading the source in a random delay', async () => {
        await clock.tickAsync(1000)
        expect(nextPlayback.play).not.toHaveBeenCalled()
        await clock.tickAsync(500) // TODO check randomness
        expect(core.activeContainer.play).toHaveBeenCalled()
      })
      it('should not call consent', async () => {
        await clock.tickAsync(1500)
        expect(nextPlayback.consent).not.toHaveBeenCalled()
      })
      describe('after reinitializing the core', () => {
        let poster: any
        let spinner: any
        beforeEach(async () => {
          await clock.tickAsync(0)
          poster = createMockPlugin()
          spinner = createSpinnerPlugin()
          core.activeContainer.getPlugin.mockImplementation((name: string) => {
            if (name === 'poster') {
              return poster
            }
            if (name === 'spinner') {
              return spinner
            }
          })
          core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED)
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
        core.emit(Events.CORE_READY)
        core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED)
        core.activePlayback.emit(Events.PLAYBACK_ERROR, {
          code: PlaybackErrorCode.MediaSourceUnavailable,
        })
        nextContainer = createMockContainer()
        nextPlayback = nextContainer.playback
        core.activePlayback = nextPlayback
        core.activeContainer = nextContainer
      })
      it('should sync with the spinner before reloading the source', async () => {
        await clock.tickAsync(1000)
        expect(core.load).not.toHaveBeenCalled()
        spinner.emit(SpinnerEvents.SYNC, {
          elapsedTime: 1000,
        })
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
        core.emit(Events.CORE_READY)
        core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED)
        core.activePlayback.emit(Events.PLAYBACK_ERROR, {
          code: PlaybackErrorCode.MediaSourceUnavailable,
        })
        await clock.tickAsync(1000)
        nextContainer = createMockContainer()
        nextPlayback = nextContainer.playback
        core.activePlayback = nextPlayback
        core.activeContainer = nextContainer
        poster = createMockPlugin()
        spinner = createSpinnerPlugin()
        core.activeContainer.getPlugin.mockImplementation((name: string) => {
          if (name === 'poster') {
            return poster
          }
          if (name === 'spinner') {
            return spinner
          }
        })
        core.emit(Events.CORE_READY)
        core.emit(Events.CORE_ACTIVE_CONTAINER_CHANGED)
        nextPlayback.emit(Events.PLAYBACK_PLAY)
        nextContainer.emit(Events.CONTAINER_PLAY, 'Container', {})
      })
      it('should enable the poster', async () => {
        expect(poster.enable).toHaveBeenCalled()
      })
      it('should hide the spinner', async () => {
        expect(spinner.hide).toHaveBeenCalled()
      })
      describe.each([
        ['buffering', 'playback:buffering'],
        ['pause', 'playback:pause'],
      ])('on a following playback:play event due to %s', (_, event) => {
        it('should do nothing', async () => {
          nextPlayback.emit(event)
          await clock.tickAsync(1000)
          nextPlayback.emit(Events.PLAYBACK_PLAY)
          await clock.tickAsync(1000)
          expect(poster.enable).toHaveBeenCalledTimes(1)
          expect(spinner.hide).toHaveBeenCalledTimes(1)
        })
      })
    })
    describe('given that playback triggers many errors in a row', () => {
      beforeEach(async () => {
        core = createMockCore({
          sources: MOCK_SOURCES,
        })
        const _ = new SourceController(core)
        core.emit('core:ready')
        core.emit('core:active:container:changed')
        core.activePlayback.emit('playback:error', {
          code: PlaybackErrorCode.MediaSourceUnavailable,
        })
        await clock.tickAsync(1)
        core.activePlayback.emit('playback:error', {
          code: PlaybackErrorCode.MediaSourceUnavailable,
        })
        await clock.tickAsync(1)
        core.activePlayback.emit('playback:error', {
          code: PlaybackErrorCode.MediaSourceUnavailable,
        })
        await clock.tickAsync(1)
        nextPlayback = createMockPlayback()
        core.activePlayback = nextPlayback
      })
      it('should run handler only once', async () => {
        expect(core.load).not.toHaveBeenCalled()
        await clock.tickAsync(1000)
        expect(core.load).toHaveBeenCalledTimes(1)
        expect(core.load).toHaveBeenCalledWith(
          MOCK_SOURCES[1].source,
          MOCK_SOURCES[1].mimeType,
        )
      })
    })
    describe('when playback was started with autoPlay', () => {
      beforeEach(async () => {
        core = createMockCore({
          sources: MOCK_SOURCES,
        })
        const _ = new SourceController(core)
        core.emit('core:ready')
        core.emit('core:active:container:changed')
        core.activeContainer.actionsMetadata.playEvent = {
          autoPlay: true,
        }
        core.activePlayback.emit('playback:error', {
          code: PlaybackErrorCode.MediaSourceUnavailable,
        })
        await clock.tickAsync(1500)
      })
      it('should call play with autoPlay metadata', () => {
        expect(core.activeContainer.play).toHaveBeenCalledWith({
          autoPlay: true,
        })
      })
    })
  })
})
