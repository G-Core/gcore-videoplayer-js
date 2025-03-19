import type { Metrics } from './types'

export function newMetrics(): Metrics {
  return {
    counters: {
      play: 0,
      pause: 0,
      error: 0,
      buffering: 0,
      decodedFrames: 0,
      droppedFrames: 0,
      fps: 0,
      changeLevel: 0,
      seek: 0,
      fullscreen: 0,
      dvrUsage: 0,
    },
    chrono: {
      startup: 0,
      watch: 0,
      pause: 0,
      buffering: 0,
      session: 0,
    },
    extra: {
      playbackName: '',
      playbackType: '',
      bitratesHistory: [],
      bitrateWeightedMean: 0,
      bitrateMostUsed: 0,
      buffersize: 0,
      watchHistory: [],
      watchedPercentage: 0,
      bufferingPercentage: 0,
      bandwidth: 0,
      duration: 0,
      currentTime: 0,
    },
  }
}
