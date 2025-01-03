export type Duration = number;

export type TimeValue = number;

export type TimePosition = {
  current: number;
  total: number;
}

export type TimeProgress = TimePosition & { start: number; };

export type TimeUpdate = TimePosition & {
  firstFragDateTime: number;
};

