
/**
 * @alpha
 */
export type TimeValue = number;

/**
 * @alpha
 */
export type TimePosition = {
  current: TimeValue;
  total: TimeValue;
}

/**
 * @alpha
 */
export type TimeProgress = TimePosition & { start: number; };

/**
 * @alpha
 */
export type TimeUpdate = TimePosition & {
  firstFragDateTime: number;
};

/**
 * @alpha
 */
export type QualityLevel = {
  level: number // index
  width: number
  height: number
  bitrate: number
}
