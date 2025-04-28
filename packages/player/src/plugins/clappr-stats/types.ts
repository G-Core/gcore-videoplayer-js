/**
 * @public
 */
export enum ClapprStatsChronograph {
  Startup = 'startup',
  Watch = 'watch',
  Pause = 'pause',
  Buffering = 'buffering',
  Session = 'session',
  // Latency = 'latency',
}

/**
 * @public
 */
export enum ClapprStatsCounter {
  Play = 'play',
  Pause = 'pause',
  Error = 'error',
  Buffering = 'buffering',
  DecodedFrames = 'decodedFrames',
  DroppedFrames = 'droppedFrames',
  Fps = 'fps',
  ChangeLevel = 'changeLevel',
  Seek = 'seek',
  Fullscreen = 'fullscreen',
  DvrUsage = 'dvrUsage',
}

/**
 * @public
 */
export type ClapprStatsMetrics = {
  /**
   * Events count counters
   */
  counters: {
    /**
     *
     */
    [ClapprStatsCounter.Play]: number
    [ClapprStatsCounter.Pause]: number
    [ClapprStatsCounter.Error]: number
    [ClapprStatsCounter.Buffering]: number
    [ClapprStatsCounter.DecodedFrames]: number
    [ClapprStatsCounter.DroppedFrames]: number
    [ClapprStatsCounter.Fps]: number
    [ClapprStatsCounter.ChangeLevel]: number
    [ClapprStatsCounter.Seek]: number
    [ClapprStatsCounter.Fullscreen]: number
    [ClapprStatsCounter.DvrUsage]: number
  }
  /**
   * Time measurements - accumulated duration of time-based activities
   */
  chrono: {
    /**
     * Time spent in the startup phase
     */
    [ClapprStatsChronograph.Startup]: number
    /**
     * Total time spent in the watch phase
     */
    [ClapprStatsChronograph.Watch]: number
    /**
     *
     */
    [ClapprStatsChronograph.Pause]: number
    [ClapprStatsChronograph.Buffering]: number
    [ClapprStatsChronograph.Session]: number
    // [Chronograph.Latency]: number;
  }
  extra: {
    playbackName: string
    playbackType: string
    bitratesHistory: ClapprStatsBitrateTrack[]
    bitrateWeightedMean: number
    bitrateMostUsed: number
    buffersize: number
    watchHistory: Array<[number, number]>
    watchedPercentage: number
    bufferingPercentage: number
    bandwidth: number
    duration: number
    currentTime: number
  }
}

/**
 * @public
 */
export type ClapprStatsBitrateTrack = {
  start: number
  end?: number
  time?: number
  bitrate: number
}

/**
 * @public
 */
export enum ClapprStatsEvents {
  /**
   * Emitted periodically with current measurements.
   */
  REPORT = 'clappr:stats:report',
  /**
   * Emitted when the playback reaches a certain percentage of the total duration.
   */
  // PERCENTAGE = 'clappr:stats:percentage',
}
