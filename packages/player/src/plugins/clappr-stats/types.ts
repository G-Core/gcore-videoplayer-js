/**
 * @beta
 */
export enum Chronograph {
  Startup = 'startup',
  Watch = 'watch',
  Pause = 'pause',
  Buffering = 'buffering',
  Session = 'session',
  // Latency = 'latency',
}

/**
 * @beta
 */
export enum Counter {
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
 * @beta
 */
export type Metrics = {
  /**
   * Events count counters
   */
  counters: {
    /**
     * 
     */
    [Counter.Play]: number;
    [Counter.Pause]: number;
    [Counter.Error]: number;
    [Counter.Buffering]: number;
    [Counter.DecodedFrames]: number;
    [Counter.DroppedFrames]: number;
    [Counter.Fps]: number;
    [Counter.ChangeLevel]: number;
    [Counter.Seek]: number;
    [Counter.Fullscreen]: number;
    [Counter.DvrUsage]: number;
  };
  /**
   * Time measurements - accumulated duration of time-based activities
   */
  chrono: {
    /**
     * Time spent in the startup phase
     */
    [Chronograph.Startup]: number;
    /**
     * Total time spent in the watch phase
     */
    [Chronograph.Watch]: number;
    /**
     * 
     */
    [Chronograph.Pause]: number;
    [Chronograph.Buffering]: number;
    [Chronograph.Session]: number;
    // [Chronograph.Latency]: number;
  };
  extra: {
    playbackName: string;
    playbackType: string;
    bitratesHistory: BitrateTrackRecord[];
    bitrateWeightedMean: number;
    bitrateMostUsed: number;
    buffersize: number;
    watchHistory: Array<[number, number]>;
    watchedPercentage: number;
    bufferingPercentage: number;
    bandwidth: number;
    duration: number;
    currentTime: number;
  };
  custom: Record<string, unknown>;
};

/**
 * @beta
 */
export type BitrateTrackRecord = {
  start: number;
  end?: number;
  time?: number;
  bitrate: number;
}

/**
 * @beta
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