export type TimeValue = number;

export type TimePosition = {
  current: TimeValue;
  total: TimeValue;
}

export type TimeProgress = TimePosition & { start: number; };

export type TimeUpdate = TimePosition & {
  firstFragDateTime: number;
};

