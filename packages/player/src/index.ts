/**
 * Video player for the GCore streaming platform
 *
 * @remarks
 * This package provides a video player for the GCore streaming platform.
 * It is built on top of the Clappr library and provides a framework for building custom integrations.
 *
 * @packageDocumentation
 */

export { LogTracer, Logger, SentryTracer, reportError, setTracer, trace } from '@gcorevideo/utils'
export * from './Player.js'
export * from './playback.types.js'
export * from './types.js'
export * from './version.js'
