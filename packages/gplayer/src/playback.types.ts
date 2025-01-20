export type TimeValue = number;

export type TimePosition = {
  current: TimeValue;
  total: TimeValue;
}

export type TimeProgress = TimePosition & { start: number; };

export type TimeUpdate = TimePosition & {
  firstFragDateTime: number;
};

export type BitrateInfo = {
  bitrate: number;
  width: number;
  height: number;
}

export type QualityLevel = {
  level: number // index
  width: number
  height: number
  bitrate: number
}
