import { ZeptoResult } from "../../types"
import { SpeedtestMetrics } from "./speedtest/types"

const qualityClasses = [
  'speedtest-quality-value-1',
  'speedtest-quality-value-2',
  'speedtest-quality-value-3',
  'speedtest-quality-value-4',
  'speedtest-quality-value-5',
]

export const getDownloadQuality = (speedValue: number): number => {
  if (speedValue < 3) {
    return 1
  } else if (speedValue < 7) {
    return 2
  } else if (speedValue < 13) {
    return 3
  } else if (speedValue < 25) {
    return 4
  } else {
    return 5
  }
}

export const getPingQuality = (pingValue: number): number => {
  if (pingValue < 20) {
    return 5
  } else if (pingValue < 50) {
    return 4
  } else if (pingValue < 100) {
    return 3
  } else if (pingValue < 150) {
    return 2
  } else {
    return 1
  }
}

export const generateQualityHtml = (quality: number): string => {
  const html = []
  const qualityClassName = qualityClasses[quality - 1]

  for (let i = 0; i < qualityClasses.length; i++) {
    if (i < quality) {
      html.push(
        `<div class="speedtest-quality-content-item ${qualityClassName}"></div>`,
      )
    } else {
      html.push('<div class="speedtest-quality-content-item"></div>')
    }
  }

  return html.join('')
}

export const drawSummary = (
  customMetrics: SpeedtestMetrics,
  vodContainer: ZeptoResult,
  liveContainer: ZeptoResult,
) => {
  const { connectionSpeed, ping } = customMetrics

  if (!connectionSpeed || !ping) {
    return
  }
  const downloadQuality = getDownloadQuality(connectionSpeed)
  const pingQuality = getPingQuality(ping)
  const liveQuality = Math.min(downloadQuality, pingQuality)
  const vodHtml = generateQualityHtml(downloadQuality)
  const liveHtml = generateQualityHtml(liveQuality)

  vodContainer.html(vodHtml)
  liveContainer.html(liveHtml)
}
