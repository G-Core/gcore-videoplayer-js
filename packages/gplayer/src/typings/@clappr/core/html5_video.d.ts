import '@clappr/core';

declare module "@clappr/core" {
    declare type HTML5VideoSettingsItem =
        | "seekbar"
        | "playpause"
        | "position"
        | "duration"
        | "fullscreen"
        | "volume"
        | "hd-indicator"
        | "playstop";

    declare type HTML5VideoSettings = {
        default: HTML5VideoSettingsItem[];
        left?: HTML5VideoSettingsItem[];
        right?: HTML5VideoSettingsItem[];
        seekEnabled?: boolean;
    }

    declare class HTML5Video extends Playback {
        settings: HTML5VideoSettings;

        readonly _minDvrSize: number;

        _onDurationChange(): void;
    }
}
