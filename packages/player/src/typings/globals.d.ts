declare interface HTMLVideoElement {
  webkitDisplayingFullscreen?: boolean
}

declare interface HTMLMediaElement {
  audioTracks?: AudioTrackList
}

declare interface AudioTrackW3C {
  readonly id: string
  enabled: boolean
  readonly kind: string
  readonly label: string
  readonly language: string
  readonly sourceBuffer: SourceBuffer | null
}

declare interface AudioTrackList {
  getTrackById(id: string): AudioTrackW3C | null
  length: number
  [index: number]: AudioTrackW3C
}

declare module '*.css'
declare module '*.scss'
declare module '*.svg'
declare module '*.ejs'
