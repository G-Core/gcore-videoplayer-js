/**
 * Video player for the Gcore streaming platform
 *
 * @remarks
 * This package provides a video player for the Gcore streaming platform.
 * It is built on top of the Clappr library and provides a framework for building custom integrations.
 * Start with {@link Player} for more information.
 *
 * Various plugins (marked with `PLUGIN` keyword) are available to extend the player with additional features.
 * @example
 * ```ts
 * import { Player, MediaControl, ErrorScreen } from '@gcorevideo/player'
 *
 * Player.registerPlugin(MediaControl)
 * Player.registerPlugin(ErrorScreen)
 *
 * const player = new Player({
 *   autoPlay: true,
 *   mute: true,
 *   sources: [{ source: 'https://example.com/a.mpd', mimeType: 'application/dash+xml' }],
 * })
 *
 * player.attachTo(document.getElementById('container'))
 * ```
 *
 * @packageDocumentation
 */
export * from './index.core.js'
export * from './index.plugins.js'
