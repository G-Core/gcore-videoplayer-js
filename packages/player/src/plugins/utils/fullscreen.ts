import { Browser, Utils } from '@clappr/core'
import { reportError } from '@gcorevideo/utils'

export const fullscreenEnabled = Utils.Fullscreen.fullscreenEnabled

export function isFullscreen(el: HTMLElement): boolean {
  const video =
    el.nodeName === 'video'
      ? (el as HTMLVideoElement)
      : el.querySelector('video')
  if (!video) {
    return false
  }
  if (Browser.isiOS) {
    return FullscreenIOS.isFullscreen(video)
  }
  return !!document.fullscreenElement
}

const FullscreenIOS = {
  isFullscreen: function (el: HTMLVideoElement): boolean {
    try {
      // @ts-ignore
      if (el.webkitDisplayingFullscreen !== undefined) {
        // @ts-ignore
        return !!el.webkitDisplayingFullscreen
      }
    } catch (e) {
      reportError(e)
    }

    return false
  },
}
