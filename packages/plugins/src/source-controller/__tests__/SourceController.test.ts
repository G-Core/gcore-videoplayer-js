import { describe, it, expect } from 'vitest'
import EventLite from 'event-lite'

import { Core as ClapprCore } from '@clappr/core'

import { SourceController } from '../SourceController'
// TODO
describe('SourceController', () => {
  it('should be a singleton', () => {
    const sc1 = new SourceController(
      Object.assign(new EventLite(), {
        config: {},
      }) as unknown as ClapprCore,
    )
    expect(false).toBe(true)
  })
})
