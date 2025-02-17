import { $ } from "@clappr/core";

export type ZeptoResult = ReturnType<typeof $>;

export type TimePosition = { current: number; total: number };

export type TimerId = ReturnType<typeof setTimeout>;
