import '../assets/style/main.scss';

export * from "./plugins/audio-selector/AudioTracks.js";
export { AudioTracks as AudioSelector } from "./plugins/audio-selector/AudioTracks.js";
export * from "./plugins/big-mute-button/BigMuteButton.js";
export * from "./plugins/bottom-gear/BottomGear.js";
export * from "./plugins/clappr-stats/ClapprStats.js";
export * from "./plugins/cmcd-config/CmcdConfig.js";
export * from "./plugins/clappr-nerd-stats/NerdStats.js";
export { NerdStats as ClapprNerdStats } from "./plugins/clappr-nerd-stats/NerdStats.js";
export * from "./plugins/click-to-pause/ClickToPause.js";
export * from "./plugins/clips/Clips.js";
export * from "./plugins/context-menu/ContextMenu.js";
export * from "./plugins/dvr-controls/DvrControls.js";
export * from "./plugins/error-screen/ErrorScreen.js";
export * from "./plugins/favicon/Favicon.js";
// _ ga-events
export * from "./plugins/google-analytics/GoogleAnalytics.js";
export * from "./plugins/logo/Logo.js";
export * from "./plugins/media-control/MediaControl.js";
export * from "./plugins/multi-camera/MultiCamera.js";
export * from "./plugins/picture-in-picture/PictureInPicture.js";
export * from "./plugins/playback-rate/PlaybackRate.js";
export * from "./plugins/poster/Poster.js";
export * from "./plugins/level-selector/QualityLevels.js";
export { QualityLevels as LevelSelector } from "./plugins/level-selector/QualityLevels.js";
export * from "./plugins/seek-time/SeekTime.js";
export * from "./plugins/share/Share.js";
export * from "./plugins/skip-time/SkipTime.js";
export * from "./plugins/spinner-three-bounce/SpinnerThreeBounce.js";
export { SpinnerThreeBounce as Spinner } from "./plugins/spinner-three-bounce/SpinnerThreeBounce.js";
export * from "./plugins/source-controller/SourceController.js";
export * from "./plugins/subtitles/ClosedCaptions.js";
export { ClosedCaptions as Subtitles } from "./plugins/subtitles/ClosedCaptions.js"; // TODO remove in future versions
export * from "./plugins/telemetry/Telemetry.js";
export * from "./plugins/thumbnails/Thumbnails.js";
// _ vast-ads
// _ video360
export * from "./plugins/volume-fade/VolumeFade.js";
