export type MetricsKind = 'general' | 'timers' | 'extra'
export type MetricType = 'general' | 'timers' | 'extra'
export type MetricsType =
  | 'volume'
  | 'startup'
  | 'watch'
  | 'pause'
  | 'buffering'
  | 'session'
  | 'latency'
  | 'buffersize'
  | 'duration'
  | 'currentTime'
  | 'bitrateWeightedMean'
  | 'bitrateMostUsed'
  | 'bandwidth'
  | 'watchedPercentage'
  | 'bufferingPercentage'
export type MetricName =
  | 'volume'
  | 'startup'
  | 'watch'
  | 'pause'
  | 'buffering'
  | 'session'
  | 'latency'
  | 'buffersize'
  | 'duration'
  | 'currentTime'
  | 'bitrateWeightedMean'
  | 'bitrateMostUsed'
  | 'bandwidth'
  | 'watchedPercentage'
  | 'bufferingPercentage'
  | 'fps'
export type MetricKind =
  | 'volume'
  | 'time'
  | 'precisetime'
  | 'percentage'
  | 'bitrate'
  | 'bandwidth'
export type MetricsValue = number
