import type {
  CorePlugin,
  ContainerPlugin,
  Playback as PlaybackPlugin,
  ExternalTrack,
} from "@clappr/core";
import { PlaybackType, PlayerDebugTag, StreamMediaSource } from "./types";

type MediacontrolStyles = {
  // TODO
  seekbar?: string;
  buttons?: string;
}

type PlayerMediaSourceDesc = {
  mimeType?: string;
  source: string;
}

export type PlayerMediaSource = string | PlayerMediaSourceDesc;

type HlsjsConfig = {
  debug?: boolean;
  startLevel?: number;
} & Record<string, unknown>;

type ShakaConfig = Record<string, unknown>;

type CorePlaybackConfig = {
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
  playInline: boolean;
  preload?: 'metadata' | 'auto' | 'none';
  // preferredAudioLanguage?: string;
  shakaConfiguration?: ShakaConfig;
}

type ErrorLevel = "FATAL" | "WARN" | "INFO";

export type PlaybackError = {
  code?: number | string;
  description: string;
  raw?: MediaError;
  level?: ErrorLevel;
}

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

export type ClapprVersionSpec = {
  min: string;
  // TODO
}

export type CorePluginOptions = {
  core?: CorePlugin[];
  container?: ContainerPlugin[];
  playback?: PlaybackPlugin[];
  loadExternalPluginsFirst?: boolean;
  loadExternalPlaybacksFirst?: boolean;
}

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
  multisources: StreamMediaSource[];
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