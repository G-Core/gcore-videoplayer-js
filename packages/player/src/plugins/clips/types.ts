/**
 * Clip description.
 * @beta
 */
export type ClipDesc = {
  /**
   * Start time of the clip in the video timeline, s.
   */
  start: number
  /**
   * Text to display over the seekbar.
   */
  text: string
  /**
   * End time of the clip (start time of the next clip).
   */
  end: number
  /**
   * Index of the clip.
   */
  // index: number
}
