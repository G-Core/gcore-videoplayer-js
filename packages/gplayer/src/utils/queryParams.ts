import { PlayerDebugTag } from "src/types";

function isValidDebugTag(tag: string): tag is PlayerDebugTag {
  return ['all', 'clappr', 'dash', 'hls', 'none'].includes(tag);
}
