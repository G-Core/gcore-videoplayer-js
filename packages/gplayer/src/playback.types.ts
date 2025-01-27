
/**
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
  level: number // index
  width: number
  height: number
  bitrate: number
}
