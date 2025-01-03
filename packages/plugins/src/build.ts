import assert from "assert";

assert(process.env.CLAPPR_VERSION, 'CLAPPR_VERSION is required');
export const CLAPPR_VERSION: string = process.env.CLAPPR_VERSION;
