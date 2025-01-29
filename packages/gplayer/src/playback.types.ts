
/**
 * Playback time in seconds since the beginning of the stream (or a segment for the live streams)
 * For the plugin development
 * @internal
 */
export type TimeValue = number;

/**
 * For the plugin development
 * @internal
 */
export type TimePosition = {
  current: TimeValue;
  total: TimeValue;
}

/**
 * For the plugin development
 * @internal
 */
export type TimeProgress = TimePosition & { start: number; };

/**
 * For the plugin development
 * @internal
 */
export type TimeUpdate = TimePosition & {
  firstFragDateTime: number;
};

/**
 * @beta
 */
export type QualityLevel = {
  level: number // 0-based index
  width: number
  height: number
  bitrate: number
}

export enum PlaybackErrorCode {
  Generic = 0,
  MediaSourceUnavailable = 1,
  QualityLevelUnavailable = 2,
}
