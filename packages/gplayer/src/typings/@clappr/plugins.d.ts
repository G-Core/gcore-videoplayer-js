import { Core, UICorePlugin } from "@clappr/core";
import "@clappr/plugins";

declare module "@clappr/plugins" {
    declare type MediaControlOptions = {
        hideMediaControlDelay?: number;
        chromeless?: boolean;
        source?: string;
        sources?: string[];
        baseUrl?: string;
        disableKeyboardShortcuts?: boolean;
        width?: number;
        height?: number;
        persistConfig?: boolean; // TODO
        focusElement?: HTMLElement;
        hideVolumeBar?: boolean;
        parentElement?: HTMLElement;
        mediacontrol?: {
            buttons: string;
            seekbar: string;
        }
    }
}
