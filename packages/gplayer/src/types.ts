export type PlayerDebugTag = 'all' | 'clappr' | 'dash' | 'hls' | 'none';
export type PlayerDebugSettings = PlayerDebugTag | boolean;

export type PlaybackType = 'live' | 'vod';
export type MediaTransport = 'dash' | 'hls' | 'mpegts';
export type TransportPreference = MediaTransport | 'auto';

export type PlayerPlugin = {
  new(...args: any[]): unknown;
  type: string; // 'core' | 'container' | 'playback';
}

export type PlayerConfig = {
  autoPlay?: boolean;
  debug?: PlayerDebugSettings;
  language?: string;
  loop?: boolean;
  multisources: StreamMediaSource[];
  mute?: boolean;
  playbackType: PlaybackType;
  pluginSettings?: Record<string, unknown>;
  poster?: string;
  priorityTransport?: TransportPreference;
  realtimeApi?: string;
  strings: TranslationSettings;
}

export type PlayerOptionsThumbnails = {
  sprite?: string | null;
  vtt?: string | null;

}

export type ContextMenuSettings = {
  preventShowContextMenu?: boolean;
}

type LangTag = string;
type TranslationKey = string;

export type BroadcastSettings = {
  status?: 'live' | 'noActiveStreams';
}

export type ClipsPluginOptions = Record<string, unknown>; // TODO

export type PlaybackSettings = {
  hlsjsConfig?: Record<string, unknown>;
  playInline?: boolean;
  preload?: 'auto' | 'metadata' | 'none';
  triggerFatalErrorOnResourceDenied?: boolean;
}

export type DashSettings = Record<string, unknown>; //

// TODO consult with the Broadcaster team
// TODO turn into camel case convert at user level
export type StreamMediaSourceDto = {
  description: string;
  dvr: boolean;
  hls_cmaf_url?: string;
  hls_mpegts_url?: string;
  id: number;
  live: boolean;
  priority_transport: TransportPreference;
  poster: string | null;
  projection: ProjectionType | null;
  screenshot: string | null;
  source: string
  source_dash: string | null;
  sprite: string | null;
  title: string;
  vtt: string | null;
}

export type StreamMediaSource = {
  description: string;
  dvr: boolean;
  hlsCmafUrl: string | null;
  hlsMpegtsUrl: string | null;
  id: number;
  live: boolean;
  priorityTransport: TransportPreference;
  poster: string | null;
  projection: ProjectionType | null;
  screenshot: string | null;
  source: string
  sourceDash: string | null;
  sprite: string | null;
  title: string;
  vtt: string | null;
}

export type SrcProjectionType = 'regular' | '360' | 'vr180' | 'vr360tb';
export type ProjectionType = '360' | '180' | '360_TB';

export type TranslationSettings = Partial<Record<LangTag, Record<TranslationKey, string>>>;

export type BitrateInfo = {
  height: number;
  width: number;
  bitrate: number;
  level: number;
};

export enum PlayerEvent {
  Ready = 'ready',
  Play = 'play',
  Pause = 'pause',
  Stop = 'stop',
  Ended = 'ended',
}
