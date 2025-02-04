import { Browser } from '@clappr/core';
import { reportError } from '@gcorevideo/player';

export function getLocation(href: string) {
  const l = document.createElement('a');

  l.href = href;

  return l;
}

export function strtimeToMiliseconds(str: string): number {
  if (!str) {
    return 0;
  }
  const arr = str.split(/:/);
  let h = 0, m = 0, s = 0;

  if (arr.length >= 3) {
    h = parseInt(arr[arr.length - 3]) * 60 * 60;
  } else {
    h = 0;
  }
  if (arr.length >= 2) {
    m = parseInt(arr[arr.length - 2]) * 60;
  } else {
    m = 0;
  }

  if (arr.length >= 1) {
    s = parseInt(arr[arr.length - 1]);
  } else {
    s = 0;
  }

  return (h + m + s);
}

// TODO refactor
export function isFullscreen(el: HTMLElement): boolean {
  const video = el.nodeName === "video" ? el as HTMLVideoElement : el.querySelector('video');
  if (!video) {
    return false;
  }
  if (Browser.isiOS) {
    return FullscreenIOS.isFullscreen(video);
  }
  return !!(document.fullscreenElement);
}

const FullscreenIOS = {
  isFullscreen: function (el: HTMLVideoElement): boolean {
    try {
      // @ts-ignore
      if (el.webkitDisplayingFullscreen !== undefined) {
        // @ts-ignore
        return !!(el.webkitDisplayingFullscreen);
      }
    } catch (e) {
      reportError(e);
    }

    return false;
  }
};

export function getPageX(event: MouseEvent | TouchEvent): number {
  if ((event as MouseEvent).pageX) {
    return (event as MouseEvent).pageX;
  }

  if ((event as TouchEvent).changedTouches) {
    return (event as TouchEvent).changedTouches[(event as TouchEvent).changedTouches.length - 1].pageX;
  }

  return 0;
}
