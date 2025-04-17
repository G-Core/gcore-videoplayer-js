import { createMockCore } from '../../../testUtils'
import { ErrorScreen } from '../ErrorScreen'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('ErrorScreen', () => {
  let core: any
  let container: any
  let playback: any
  let errorScreen: ErrorScreen
  beforeEach(() => {
    core = createMockCore()
    container = core.activeContainer
    playback = container.playback
    core.activeContainer = container
  })
  describe('on error', () => {
    describe.each([
      [
        'targeted at UI',
        {
          code: "foo",
          UI: {
            title: 'My error',
            message: 'Lorem ipsum dolor sit amet',
            icon: '<svg>...</svg>'
          },
        },
        true,
      ],
      [
        'other',
        {
          code: 'MEDIA_SOURCE_ACCESS_DENIED',
          title: 'The server refused to serve the protected media',
          message: 'Wrong credentials',
        },
        false,
      ],
    ])("%s", (_, err, shouldRender) => {
      beforeEach(() => {
        errorScreen = new ErrorScreen(core)
        core.emit('core:ready')
        core.emit('core:active:container:changed')
        core.emit('error', err)
      })
      if (shouldRender) {
        it('should render', () => {
          expect(errorScreen.el.innerHTML).toBeTruthy()
          expect(errorScreen.el.innerHTML).toMatchSnapshot()
        })
      } else {
        it('should not render', () => {
          expect(errorScreen.el.innerHTML).toBeFalsy()
        })
      }
    })
    describe('reload button', () => {
      describe('basically', () => {
        beforeEach(() => {
          core.options.source = 'https://222/master.mpd'
          errorScreen = new ErrorScreen(core)
          core.emit('core:ready')
          core.emit('core:active:container:changed')
          core.emit('error', {
            code: 'foo',
            UI: {
              title: 'My error',
              message: 'Lorem ipsum dolor sit amet',
              icon: '<svg>...</svg>'
            },
          })
          core.configure.mockClear()
        })
        describe('when clicked', () => {
          beforeEach(async () => {
            (errorScreen.el.querySelector('.player-error-screen__reload') as HTMLElement)?.click()
            return new Promise(resolve => setTimeout(resolve, 0))
          })
          it('should reload the player', () => {
            expect(core.configure).toHaveBeenCalledWith(expect.objectContaining({
              reloading: true,
              source: 'https://222/master.mpd'
            }))
          })
        })
      })
      describe('when disabled', () => {
        beforeEach(() => {
          core.options.errorScreen = {
            noReload: true
          }
          errorScreen = new ErrorScreen(core)
          core.emit('core:ready')
          core.emit('core:active:container:changed')
          core.emit('error', {
            code: 'foo',
            UI: {
              title: 'My error',
              message: 'Lorem ipsum dolor sit amet',
              icon: '<svg>...</svg>'
            },
          })
        })
        it('should not render the reload button', () => {
          expect(errorScreen.el.querySelector('.player-error-screen__reload')).toBeNull()
        })
      })
    })
  })
})


