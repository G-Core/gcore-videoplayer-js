
/**
 * @beta
 */
export type Metrics = {
  counters: {
    play: number;
    pause: number;
    error: number;
    buffering: number;
    decodedFrames: number;
    droppedFrames: number;
    fps: number;
    changeLevel: number;
    seek: number;
    fullscreen: number;
    dvrUsage: number;
  };
  timers: {
    startup: number;
    watch: number;
    pause: number;
    buffering: number;
    session: number;
    latency: number;
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
export type MetricsUpdateFn = (metrics: Metrics) => void;

/**
 * @beta
 */
export enum ClapprStatsEvents {
  REPORT_EVENT = 'clappr:stats:report',
  PERCENTAGE_EVENT = 'clappr:stats:percentage',
}