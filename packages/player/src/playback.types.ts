/**
 * Playback time in seconds since the beginning of the stream (or a segment for the live streams)
 * @public
 */
export type TimeValue = number

/**
 * Current playback time and total duration of the media.
 * @public
 */
export interface TimePosition {
  /**
   * Current playback time, 0..duration, seconds.
   */
  current: TimeValue
  /**
   * Total duration of the media, seconds.
   */
  total: TimeValue
}

/**
 * For the plugin development
 * @beta
 */
export type TimeProgress = TimePosition & { start: number }

/**
 * For the plugin development
 * @beta
 */
export type TimeUpdate = TimePosition & {
  firstFragDateTime: number
}

/**
 * A level of quality within a media source.
 * @public
 */
export interface QualityLevel {
  /**
   * Zero-based index of the quality level.
   */
  level: number
  /**
   * Width of the video, pixels.
   */
  width: number
  /**
   * Height of the video, pixels.
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
   * Exact component that originated the error.
   * @example
   * - 'core'
   * - 'dash'
   * - 'media_control'
   */
  origin: string
  /**
   * Component subsystem of the error origin
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
