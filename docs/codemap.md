# Code Map

## Repository entry points

### Root level

- `README.md`: human-facing overview of the JavaScript player SDK and product positioning
- `DOCS.md`: project knowledge index for agents and contributors
- `packages/player`: main SDK package
- `packages/utils`: shared logging and helper package
- `docs`: repository-level deep documentation and media assets

## Main package: `packages/player`

### Public entry points

- `src/index.ts`: full public SDK entry, exports core plus supported plugins
- `src/index.core.ts`: core-only exports
- `src/index.plugins.ts`: supported built-in plugin exports
- `src/index.embed.ts`: opinionated embed initializer with default plugin registration

### Core runtime

- `src/Player.ts`: main application-facing player class
- `src/types.ts`: public config, event, source, and plugin types
- `src/playback.types.ts`: public playback error and time-position types
- `src/version.ts`: package version export

### Playback subsystem

- `src/playback/index.ts`: playback registration and transport helpers
- `src/playback/HTML5Video.ts`: HTML5/MP4 playback
- `src/playback/hls-playback/HlsPlayback.ts`: HLS playback integration
- `src/playback/dash-playback/DashPlayback.ts`: DASH playback integration

### Source preparation

- `src/utils/mediaSources.ts`: source wrapping, MIME type guessing, and transport ordering

### Plugin subsystem

Path:

- `src/plugins/`

Publicly exported plugin families include:

- core UX: `MediaControl`, `BottomGear`, `Spinner`, `Poster`, `ErrorScreen`
- playback controls: `PlaybackRate`, `PictureInPicture`, `SeekTime`, `SkipTime`, `ClickToPause`, `DvrControls`
- track and quality controls: `Subtitles`, `AudioTracks`, `QualityLevels`
- discovery and richer viewing: `Thumbnails`, `Clips`, `MultiCamera`
- branding and actions: `Logo`, `Share`, `Favicon`
- observability and delivery: `Telemetry`, `ClapprStats`, `NerdStats`, `CmcdConfig`, `GoogleAnalytics`
- source management: `SourceController`

If a feature is present in `src/plugins/` but not exported from `src/index.plugins.ts`, treat it as non-primary or non-public for general SDK messaging.

### Assets and generated docs

- `assets/`: shared styles and plugin templates
- `docs/api/`: generated API reference for the published package

## Shared package: `packages/utils`

This package contains shared logging, tracing, remote reporting, and utility helpers used by the player runtime. The main player package re-exports the logging surface from here.

## Where to start for common tasks

### Product-facing SDK overview

- `README.md`

### Understand public API

- `packages/player/src/index.ts`
- `packages/player/src/Player.ts`
- `packages/player/src/types.ts`
- `packages/player/docs/api/player.md`

### Add or inspect playback behavior

- `packages/player/src/playback/`
- `packages/player/src/utils/mediaSources.ts`

### Add or inspect UI features

- `packages/player/src/plugins/`
- `packages/player/src/index.plugins.ts`

### Understand runtime packaging

- `packages/player/package.json`
- `packages/player/src/index.embed.ts`
