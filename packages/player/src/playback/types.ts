export enum PlaybackEvents {
  /**
   * Emitted when the playback rate changes.
   * Payload:
   * - playbackRate number
   */
  PLAYBACK_RATE_CHANGED = 'playback:rate-changed',
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
