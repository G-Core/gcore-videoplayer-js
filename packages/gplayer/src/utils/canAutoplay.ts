import { Browser } from '@clappr/core';
import canAutoPlay from 'can-autoplay';

import { reportError, trace } from "../trace/index.js";

export type CanAutoplayResult = {
  autoPlay: boolean;
  muted: boolean;
}

export default async function (): Promise<CanAutoplayResult> {
  let autoPlay = false;
  let muted = false;

  trace("canAutoplay enter");

  try {
    const autoplay = await canAutoPlay.video();

    if (autoplay.result) {
      autoPlay = true;
    } else {
      const checkObj = Browser.isiOS ? { muted: true, inline: true } : { muted: true };
      const mute = await canAutoPlay.video(checkObj);

      if (!mute.result) {
        autoPlay = false;
      } else {
        muted = true;
        autoPlay = true;
      }
    }
  } catch (e) {
    reportError(e);
  }

  trace("canAutoplay leave", { autoPlay, muted });
  return { autoPlay, muted };
}
