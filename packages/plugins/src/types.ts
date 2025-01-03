import { $ } from "@clappr/core";

export type ZeptoResult = ReturnType<typeof $>;

export type TimePosition = { current: number; total: number };
// export type TimeProgress = { start: number; total: number; current: number };

export type TimerId = ReturnType<typeof setTimeout>;

export type QualityLevelInfo = {
  level: number;
  width: number;
  height: number;
  bitrate: number;
};
