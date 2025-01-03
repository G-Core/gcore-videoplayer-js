import "@clappr/core";

declare module "@clappr/core" {
    type MediacontrolStyles = {
        // TODO
    }

    type PlayerMediaSourceDesc = {
        mimeType?: string;
        source: string;
    }

    type PlayerMediaSource = string | PlayerMediaSourceDesc;

    type ExternalTrack = {
        kind?: "subtitles";
        src: string;
        label: string;
        lang: string;
    }

    type HlsjsConfig = {
        debug?: boolean;
        startLevel?: number;
    } & Record<string, unknown>;

    type ShakaConfig = Record<string, unknown>;

    declare type CorePlaybackConfig = {
        // audioOnly: boolean;
        disableContextMenu?: boolean;
        controls?: boolean;
        crossOrigin?: 'anonymous' | 'use-credentials';
        // enableAutomaticABR?: boolean;
        externalTracks?: unknown[]; // TODO
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
        // preferredTextLanguage?: string;
        // preferredAudioLanguage?: string;
        shakaConfiguration?: ShakaConfig;
    }

    type ErrorLevel = "FATAL" | "WARN" | "INFO";

    declare type EventSpec = string;
    declare type EventHandlerSpec = string;
    declare type PluginEventsConfig = Record<EventSpec, EventHandlerSpec>;

    declare type PlaybackError = {
        code?: number | string;
        description: string;
        raw?: MediaError;
        level?: ErrorLevel;
    }

    declare type CorePlayerEvents = {
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

    declare type ClapprVersionSpec = {
        min: string;
        // TODO
    }
}