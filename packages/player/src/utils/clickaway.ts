import { Browser } from '@clappr/core'

/**
 *
 * @param {() => void} callback - The callback to call when the user clicks away from the element
 * @returns {(HTMLElement | null) => void}
 */
export function clickaway(callback: () => void) {
  let handler = (event: MouseEvent | TouchEvent) => {}

  return (node: HTMLElement | null) => {
    window.removeEventListener('click', handler)
    if (!node) {
      return
    }
    handler = (event: MouseEvent | TouchEvent) => {
      if (!node.contains(event.target as Node)) {
        window.removeEventListener('click', handler)
        callback()
      }
    }
    window.addEventListener('click', handler)
  }
}

/**
 * Sets up a clickaway handler for the media control on mobile devices.
 * The handler is deferred to ensure the click that opened the menu does not immediately re-trigger it.
 *
 * @param {() => void} callback - The callback to call when the user clicks away from the media control
 * @returns {(HTMLElement | null) => void}
 */
export function mediaControlClickaway(callback: () => void) {
  if (!Browser.isMobile) {
    return () => {}
  }
  const cw = clickaway(callback)
  return (node: HTMLElement | null) => {
    setTimeout(() => {
      cw(node)
    }, 0)
  }
}
