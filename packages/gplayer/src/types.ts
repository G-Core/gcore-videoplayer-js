// import { PlayerMediaSource } from "./internal.types"
/**
 * @alpha
 */
export type PlayerMediaSourceDesc = {
  mimeType?: string;
  source: string;
}

/**
 * @alpha
 */
export type PlayerMediaSource = string | PlayerMediaSourceDesc;

/**
 * @alpha
 */
export type PlayerDebugTag = 'all' | 'clappr' | 'dash' | 'hls' | 'none'
/**
 * @alpha
 */
export type PlayerDebugSettings = PlayerDebugTag | boolean

/**
 * @alpha
 */
export type PlaybackType = 'live' | 'vod'
/**
 * @alpha
 */
export type MediaTransport = 'dash' | 'hls' | 'mpegts'
/**
 * @alpha
 */
export type TransportPreference = MediaTransport | 'auto'

/**
 * @alpha
 */
export type PlayerPlugin = {
  new (...args: any[]): unknown
  type: string // 'core' | 'container' | 'playback';
}

/**
 * @alpha
 */
export type PlayerConfig = {
  /**
   * @defaultValue false  Start playback automatically when the player is ready.
   * Should be used together with the `mute` to avoid issues with autoplay policies.
   */
  autoPlay?: boolean
  /**
   * @defaultValue \{\}  Configuration for the DASH playback engine
   */
  dash?: DashSettings
  /**
   * @defaultValue 'none'  Debugging level
   */
  debug?: PlayerDebugSettings
  /**
   * @defaultValue 'en'  Default language for the player UI
   */
  language?: string
  /**
   * @defaultValue false  Repeat playback when the end of the media is reached
   */
  loop?: boolean
  /**
   * @defaultValue false  Mute the audio
   */
  mute?: boolean
  /**
   * @defaultValue 'vod'  Playback type
   */
  playbackType?: PlaybackType
  /**
   * @defaultValue \{\}  Configuration options for various plugins
   */
  pluginSettings?: Record<string, unknown>
  /**
   * @defaultValue 'auto'  Priority transport to use when multiple sources are available.
   * Affects the order of source selection from the `sources` list
   */
  priorityTransport?: TransportPreference
  /**
   * List of media sources. The first supported source will be used.
   */
  sources: PlayerMediaSource[];
  /**
   * List of localizations for the player UI
   */
  strings: TranslationSettings
}

/**
 * @alpha
 */
export type LangTag = string

/**
 * @alpha
 */
export type TranslationKey = string

/**
 * @alpha
 */
export type DashSettings = Record<string, unknown> //

/**
 * @alpha
 */
export type StreamMediaSource = {
  description: string
  dvr: boolean
  hlsCmafUrl: string | null
  hlsMpegtsUrl: string | null
  id: number
  live: boolean
  priorityTransport: TransportPreference
  poster: string | null
  projection: ProjectionType | null
  screenshot: string | null
  source: string | null
  sourceDash: string | null
  sprite: string | null
  title: string
  vtt: string | null
}

/**
 * @alpha
 */
export type SrcProjectionType = 'regular' | '360' | 'vr180' | 'vr360tb'
/**
 * @alpha
 */
export type ProjectionType = '360' | '180' | '360_TB'

/**
 * @alpha
 */
export type TranslationSettings = Partial<
  Record<LangTag, Record<TranslationKey, string>>
>

/**
 * @alpha
 */
export enum PlayerEvent {
  Ready = 'ready',
  Play = 'play',
  Pause = 'pause',
  Stop = 'stop',
  Ended = 'ended',
}
