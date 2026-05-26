export enum PlaybackEvents {
  /**
   * Emitted when the playback rate changes.
   * Payload:
   * - playbackRate number
   */
  PLAYBACK_RATE_CHANGED = 'playback:rate-changed',
  /**
   * Emitted periodically for live streams with latency diagnostics.
   * Payload: {@link LiveMetrics}
   */
  LIVE_METRICS = 'playback:live-metrics',
}

/**
 * Diagnostic data for live stream timing health.
 * @public
 */
export type LiveMetrics = {
  /** Current latency behind the live edge in seconds. */
  liveLatency: number
  /** Target latency configured by the player in seconds. */
  targetLatency: number
  /**
   * Per-segment timing drift in seconds. Present only after the first segment completes.
   * Negative = segment arrived earlier than its declared duration (expected for LL-DASH with ATO).
   * Trending toward 0 or positive = encoder producing shorter segments than declared; player will
   * eventually request segments before the CDN has encoded them.
   */
  segmentDrift?: number
  /** Sum of segmentDrift across all segments since playback started. Present only after the first segment completes. */
  accumulatedDrift?: number
}

/**
 * @internal
 */
export type VTTCueInfo = {
  id: string
  start: number
  end: number
  text: string
}
