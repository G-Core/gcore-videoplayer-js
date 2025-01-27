/**
 * Describes a media source with its MIME type and URL.
 *
 * @remarks
 * When the MIME type is provided, it helps the player determine the appropriate playback engine.
 * If omitted, the player will attempt to detect the type from the source URL extension.
 * @beta
 */
export interface PlayerMediaSourceDesc {
  /**
   * The MIME type of the media source (e.g. "video/mp4", "application/x-mpegURL")
   */
  mimeType?: string

  /**
   * URL of the media source
   */
  source: string
}

/**
 * A media source to fetch the media data from
 * @beta
 */
export type PlayerMediaSource = string | PlayerMediaSourceDesc

/**
 * @beta
 */
export type PlayerDebugTag = 'all' | 'clappr' | 'dash' | 'hls' | 'none'

/**
 * @remarks true is equivalent to 'all', false is equivalent to 'none'
 * @beta
 */
export type PlayerDebugSettings = PlayerDebugTag | boolean

/**
 * Type of a stream playback
 * @beta
 */
export type PlaybackType = 'live' | 'vod'

/**
 * @beta
 */
export type MediaTransport = 'dash' | 'hls' | 'mpegts'

/**
 * @beta
 */
export type TransportPreference = MediaTransport | 'auto'

/**
 * @beta
 * @see {@link https://clappr.github.io/classes/UIContainerPlugin.html}, {@link https://clappr.github.io/classes/ContainerPlugin.html}
 */
export type PlayerPlugin = {
  new (...args: any[]): unknown
  type: 'core' | 'container'
}

/**
 * Configuration options for the player
 *
 * @remarks
 *  You can specify multiple sources, each in two forms: just a plain URL or a full object with `source` and `mimeType` fields {@link PlayerMediaSource}.
 *  The player will pick the first viable media source according to the source availability, and either the transport preference or standard transport selection order.
 *
 * `priorityTransport` is used to specify the preferred transport protocol
 * when multiple sources are available.
 * It will first try to use the transport specified if it's supported (by a playback engine) and the source is available.
 * Otherwise it will try the other transports in the regular order (dash, hls, mpegts).
 *
 * The `autoPlay` option should be used together with the {@link PlayerConfig.mute | mute} to avoid issues with the browsers' autoplay policies.
 *
 * Note that the `playbackType` is specified explicitly in the examle below, but a playback engine might be able to detect the type of the stream automatically.
 *
 * A plugin options can be specified in the configuration object under a unique key, typically corresponding to the plugin name.
 * The plugin object will have access to the internal normalized configuration object that contains all the custom options.
 * in the examle below, the `poster` field is the `Poster` plugin configuration options.
 *
 * @example
 * ```ts
 * {
 *   autoPlay: true,
 *   mute: true,
 *   playbackType: 'live',
 *   priorityTransport: 'dash',
 *   sources: [{
 *     source: 'https://example.com/myownair66.mpd',
 *     mimeType: 'application/dash+xml',
 *   }, {
 *     source: 'https://example.com/myownair66.m3u8',
 *     mimeType: 'application/x-mpegURL',
 *   }],
 *   poster: {
 *     url: settings.poster,
 *   },
 * }
 * ```
 * @beta
 */
export interface PlayerConfig extends Record<string, unknown> {
  /**
   * Start playback automatically when the player is ready
   * @defaultValue false
   */
  autoPlay?: boolean

  /**
   * Configuration settings for the DASH playback engine
   * @defaultValue \{\}
   * {@link https://cdn.dashjs.org/latest/jsdoc/module-Settings.html}
   */
  dash?: DashSettings

  /**
   * Controls the debug output level
   * @defaultValue 'none'
   */
  debug?: PlayerDebugSettings

  /**
   * A language code for the player UI, for example, `es`. Must reference a key in the {@link PlayerConfig.strings | strings} record.
   * @defaultValue 'en'
   */
  language?: string

  /**
   * Repeat playback when the media ends.
   * Is used with the `vod` {@link PlayerConfig.playbackType | playbackType}
   * @defaultValue false
   */
  loop?: boolean

  /**
   * Mute the audio output in order to comply with browsers' autoplay policy.
   * @defaultValue false
   */
  mute?: boolean

  /**
   * The type of playback (live stream or video on demand).
   *
   * @defaultValue 'vod'
   */
  playbackType?: PlaybackType

  /**
   * Preferred transport protocol when multiple sources are available.
   * @defaultValue 'auto'
   */
  priorityTransport?: TransportPreference

  /**
   * List of media sources, at least one is required.
   */
  sources: PlayerMediaSource[]

  /**
   * Localization strings for the player UI.
   */
  strings: TranslationSettings
}

/**
 * @beta
 */
export type LangTag = string

/**
 * @beta
 */
export type TranslationKey = string

/**
 * @beta
 * {@link https://cdn.dashjs.org/latest/jsdoc/module-Settings.html | DASH.js settings}
 */
export type DashSettings = Record<string, unknown>

/**
 * [language][key] =\> string
 * @example
 * ```
 * {
 *   en: {
 *     play: 'Play',
 *     ...
 *   },
 *   es: {
 *     play: 'Reproducir',
 *     ...
 *   },
 *   ...
 * }
 * ```
 *
 * @beta
 */
export type TranslationSettings = Partial<
  Record<LangTag, Record<TranslationKey, string>>
>

/**
 * A top-level event on the player object
 * @beta
 */
export enum PlayerEvent {
  /**
   * The player is ready to use.
   */
  Ready = 'ready',
  /**
   * Playback has started.
   */
  Play = 'play',
  /**
   * Playback has been paused.
   */
  Pause = 'pause',
  /**
   * Playback has been stopped.
   */
  Stop = 'stop',
  /**
   * Playback has reached the end of the media.
   */
  Ended = 'ended',
}
