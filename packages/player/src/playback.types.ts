/**
 * Playback time position in seconds since the beginning of the stream.
 * For the live streams this is limited to the length of a segment. When DVR is enabled, this refers to the 
 * @public
 */
export type TimeValue = number

/**
 * Current playback time and total duration of the media.
 * @public
 */
export interface TimePosition {
  /**
   * Current playback time, 0..duration
   */
  current: TimeValue
  /**
   * Total duration of the media content (or DVR window size or segment duration for live streams)
   */
  total: TimeValue
}

/**
 * Time progress information indicated by Clappr CONTAINER_PROGRESS and PLAYBACK_PROGRESS events.
 * @beta
 */
export type TimeProgress = {
  /**
   * Current playback time
   */
  start: TimeValue
  /**
   * Current buffer length beginning from the start (=current) time
   */
  current: TimeValue
  /**
   * Total duration of the media content
   */
  total: TimeValue
}

/**
 * For the plugin development
 * @beta
 * @deprecated  Use TimePosition instead
 */
export type TimeUpdate = TimePosition

/**
 * A level of quality within a media source/representation.
 * @public
 */
export interface QualityLevel {
  /**
   * Zero-based index of the quality level.
   * Quality levels go from low to high
   */
  level: number
  /**
   * Width of the video frame, pixels.
   */
  width: number
  /**
   * Height of the video frame, pixels.
   */
  height: number
  /**
   * Bitrate of the video, bps.
   */
  bitrate: number
}

/**
 * Codes of errors occurring within the playback component.
 * @public
 */
export enum PlaybackErrorCode {
  /**
   * An unknown or uncategorised error.
   */
  Generic = 'GENERIC_ERROR',
  /**
   * The media source is not available. Typically a network error.
   */
  MediaSourceUnavailable = 'MEDIA_SOURCE_UNAVAILABLE',
  /**
   * The media source is not accessible due to some protection policy.
   */
  MediaSourceAccessDenied = 'MEDIA_SOURCE_ACCESS_DENIED',
}

/**
 * Levels of severity of errors. Non-fatal errors usually can be ignored.
 * @public
 */
export type ErrorLevel = 'FATAL' | 'WARN' | 'INFO'

/**
 * Subsystems of a player component.
 * @public
 */
export type PlayerComponentType = 'container' | 'core' | 'playback'

/**
 * An error occurred during the playback.
 * @public
 */
export interface PlaybackError {
  /**
   * Error code.
   */
  code: PlaybackErrorCode
  /**
   * Detailed description of the error.
   */
  description: string
  /**
   * Level of severity of the error.
   */
  level: ErrorLevel
  /**
   * Error message. Non-fatal usually can be ignored.
   */
  message: string
  /**
   * Name of the component that originated the error.
   * @example
   * - 'core'
   * - 'dash'
   * - 'media_control'
   */
  origin: string
  /**
   * Component subsystem of the error origin, together with the `origin` uniquely identifies the originating component.
   */
  scope: PlayerComponentType

  /**
   * UI description of the error.
   */
  UI?: {
    title: string
    message: string
    icon?: string
  }
}

