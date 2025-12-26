export function getLocation(href: string) {
  const l = document.createElement('a')

  l.href = href

  return l
}

/**
 * Parse a time string in the format "hh:mm:ss" or "mm:ss" or "ss" to seconds.
 * @param str - The time string to parse.
 * @returns The time in seconds.
 * @example "01:01:00" -> 3660
 * @example "01:00" -> 60
 * @example "33" -> 33
 */
export function parseClipTime(str: string): number {
  if (!str) {
    return 0
  }
  const arr = str.split(/:/)
  let h = 0,
    m = 0,
    s = 0

  if (arr.length >= 3) {
    h = parseInt(arr[arr.length - 3]) * 60 * 60
  }
  if (arr.length >= 2) {
    m = parseInt(arr[arr.length - 2]) * 60
  }

  if (arr.length >= 1) {
    s = parseInt(arr[arr.length - 1])
  }

  return h + m + s
}

export function getPageX(event: MouseEvent | TouchEvent): number {
  if ((event as MouseEvent).pageX) {
    return (event as MouseEvent).pageX
  }

  if ((event as TouchEvent).changedTouches) {
    return (event as TouchEvent).changedTouches[
      (event as TouchEvent).changedTouches.length - 1
    ].pageX
  }

  return 0
}
