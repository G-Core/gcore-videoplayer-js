import { ClipDesc } from './types.js'
import { parseClipTime } from '../utils.js'

type ClipItem = {
  start: number
  text: string
}

export function parseClips(text: string): ClipDesc[] {
  const clipsArr = text
    .split('\n')
    .map((val: string) => {
      const matchRes = val.match(/(((\d+:)?\d+:)?\d+) (.+)/i)
      return matchRes
        ? {
            start: parseClipTime(matchRes[1]),
            text: matchRes[4],
          }
        : null
    })
    .filter((clip: ClipItem | null) => clip !== null)
    .sort((a: ClipItem, b: ClipItem) => a.start - b.start)
  return clipsArr.map((clip: ClipItem, index: number) => ({
    start: clip.start,
    text: clip.text,
    end: index < clipsArr.length - 1 ? clipsArr[index + 1].start : 0,
  }))
}

export function buildSvg(clips: ClipDesc[], duration: number, barWidth: number): string {
  let svg =
    '<svg width="0" height="0">\n' + '<defs>\n' + '<clipPath id="myClip">\n'
  let rightEdge = 0

  clips.forEach((val) => {
    const end = val.end || duration

    const chunkWidth = Math.round(((end - val.start) * barWidth) / duration)

    svg += `<rect x="${rightEdge}" y="0" width="${
      chunkWidth - 2
    }" height="30"/>\n`
    rightEdge += chunkWidth
  })

  if (rightEdge < barWidth) {
    svg += `<rect x="${rightEdge}" y="0" width="${
      barWidth - rightEdge
    }" height="30"/>\n`
  }
  svg += '</clipPath>' + '</defs>' + '</svg>'

  return svg
}
