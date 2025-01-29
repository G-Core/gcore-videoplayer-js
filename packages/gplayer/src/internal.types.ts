import type {
  CorePlugin,
  ContainerPlugin,
  Playback as ClapprPlayback,
} from "@clappr/core";

import { PlaybackType, PlayerDebugTag, PlayerMediaSource } from "./types";

type ExternalTrack = {
  kind?: "subtitles" | "captions";
  src: string;
  label: string;
  lang: string;
}

type MediacontrolStyles = {
  // TODO
  seekbar?: string;
  buttons?: string;
}

/**
 * HLS.js configuration options to use with the HlsPlayback plugin.
 * @beta
 */
type HlsjsConfig = {
  debug?: boolean;
  startLevel?: number;
} & Record<string, unknown>;

type ShakaConfig = Record<string, unknown>;

/**
 * @see {@link https://github.com/clappr/clappr-core?tab=readme-ov-file#playback-configuration | the Clappr playback settings}
 * @beta
 */
export interface CorePlaybackConfig {
  // audioOnly: boolean;
  disableContextMenu?: boolean;
  controls?: boolean;
  crossOrigin?: 'anonymous' | 'use-credentials';
  // enableAutomaticABR?: boolean;
  externalTracks?: ExternalTrack[];
  hlsjsConfig?: HlsjsConfig;
  // initialBandwidthEstimate?: number;
  // maxBufferLength?: number;
  // maxBackBufferLength?: number;
  // minBufferLength?: number;
  minimumDvrSize?: number; // TODO ?
  // maxAdaptiveBitrate?: number;
  // maxAdaptiveVideoDimensions?: unknown; // TODO
  mute?: boolean;
  playInline: boolean;
  preload?: 'metadata' | 'auto' | 'none';
  // preferredAudioLanguage?: string;
  shakaConfiguration?: ShakaConfig;
}

type ErrorLevel = "FATAL" | "WARN" | "INFO";

/**
 * @internal
 */
export type PlaybackError = {
  code?: number | string;
  description: string;
  raw?: MediaError;
  level?: ErrorLevel;
  message: string;
  scope?: string;
}

/**
 * @internal
 */
export type CorePlayerEvents = {
  // TODO event arguments types
  onReady?: () => void;
  onResize?: (data: { width: number; height: number }) => void;
  onPlay?: (metadata: unknown) => void;
  onPause?: (metadata: unknown) => void;
  onStop?: (metadata: unknown) => void;
  onEnded?: () => void;
  onSeek?: (currentTime: number) => void;
  onError?: (err: PlaybackError) => void;
  onTimeUpdate?: (timeProgress: { current: number; total: number }) => void;
  onVolumeUpdate?: (value: number) => void;
  onSubtitleAvailable?: () => void;
}

/**
 * @internal
 */
export type PlaybackPluginFactory = typeof ClapprPlayback;

/**
 * For the plugin development
 * @internal
 */
export type CorePluginOptions = {
  core?: CorePlugin[];
  container?: ContainerPlugin[];
  playback?: PlaybackPluginFactory[];
  loadExternalPluginsFirst?: boolean;
  loadExternalPlaybacksFirst?: boolean;
}

/**
 * For the plugin development
 * @internal
 */
export type CoreOptions = {
  actualLiveTime?: boolean;
  actualLiveServerTime?: string;
  allowUserInteraction?: boolean;
  autoPlay?: boolean;
  autoSeekFromUrl?: boolean;
  chromeless?: boolean;
  debug?: PlayerDebugTag | boolean;
  disableCanAutoPlay?: boolean; // custom, for reconfiguration
  disableKeyboardShortcuts?: boolean;
  disableVideoTagContextMenu?: boolean;
  events?: CorePlayerEvents;
  exitFullscreenOnEnd?: boolean;
  gaAccount?: string;
  gaTrackerName?: string;
  height?: number;
  hideMediaControl?: boolean;
  hideVolumeBar?: boolean;
  language?: string;
  loop?: boolean;
  maxBufferLength?: number;
  mediacontrol?: MediacontrolStyles;
  mimeType?: string;
  mute?: boolean;
  persistConfig?: boolean;
  preload?: "auto" | "metadata" | "none";
  parentId?: string;
  parent?: HTMLElement;
  playback?: CorePlaybackConfig;
  playbackNotSupportedMessage?: string;
  playbackType?: PlaybackType;
  plugins?: CorePluginOptions | CorePlugin[];
  poster?: string;
  source?: string;
  sources?: PlayerMediaSource[];
  watermark?: string;
  watermarkLink?: string;
  width?: number;
}