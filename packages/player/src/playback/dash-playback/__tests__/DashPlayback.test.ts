import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import DashPlayback from '../DashPlayback.js'

describe('DashPlayback', () => {
  describe('canPlay', () => {
    let mms: any
    let mse: any
    let wkmse: any
    beforeEach(() => {
      mms = globalThis.ManagedMediaSource
      mse = globalThis.MediaSource
      wkmse = globalThis.WebKitMediaSource
    })
    afterEach(() => {
      globalThis.MediaSource = mse
      globalThis.ManagedMediaSource = mms
      globalThis.WebKitMediaSource = wkmse
    })
    describe('when not supported', () => {
      beforeEach(() => {
        // @ts-ignore
        globalThis.MediaSource = undefined
        // @ts-ignore
        globalThis.ManagedMediaSource = undefined
        // @ts-ignore
        globalThis.WebKitMediaSource = undefined
      })
      describe.each([
        ['http://example.com/test.mpd', undefined, false],
        ['http://example.com/123123_1232', 'application/dash+xml', false],
      ])('%s %s', (resource, mimeType, expected) => {
        it('should return false', () => {
          expect(DashPlayback.canPlay(resource, mimeType)).toBe(expected)
        })
      })
    })
    describe('when supported', () => {
      beforeEach(() => {
        if (!mse) {
          // @ts-ignore
          globalThis.MediaSource = () => ({})
        }
      })
      describe.each([
        ['http://example.com/test.mpd', undefined, true],
        ['http://example.com/123123_1232', 'application/dash+xml', true],
        ['http://example.com/123123_1232.mpd', 'video/mp4', false],
        ['http://example.com/123123_1232.m3u8', 'application/dash+xml', true],
        ['http://example.com/123123_1232', undefined, false],
      ])('%s %s', (resource, mimeType, expected) => {
        it('should respect the mime type if present and the file extention otherwise', () => {
          expect(DashPlayback.canPlay(resource, mimeType)).toBe(expected)
        })
      })
    })
  })
})
