# PROJECT DOCUMENTATION

This file gives the project-specific context that is not obvious from a quick read of the codebase. Use it as the entry point, then go deeper into `docs/` or the generated API docs when needed.

## Project purpose

`gcore-videoplayer-js` is the JavaScript player SDK for Gcore Video Streaming. It complements the built-in iframe player and is meant for customers who need playback embedded directly into their web application with JavaScript control, extensibility, and tighter product integration.

The SDK supports live and VOD playback for:

- HLS
- MPEG-DASH
- MP4

## High-level architecture

The player is structured in layers:

1. Public SDK layer: `Player`, public types, events, and plugin exports.
2. Player orchestration layer: configuration normalization, attachment to a DOM node, event forwarding, and source loading.
3. Playback layer: transport-specific playback modules for DASH, HLS, and HTML5 video.
4. Plugin layer: UI, control, analytics, and playback-adjacent features implemented as Clappr plugins.
5. Utility/telemetry layer: logging, tracing, error reporting, and shared helpers from `@gcorevideo/utils`.

The runtime is built on top of Clappr, with Gcore-specific playback modules and plugins layered on top.

## Tech stack and key dependencies

- TypeScript for the SDK source
- Rollup for bundling
- Clappr as the player core and plugin runtime
- `dashjs` for DASH playback
- `hls.js` for HLS playback
- Vitest and happy-dom for tests

## Non-obvious conventions

- The public package entry is `packages/player/src/index.ts`, which combines core exports and supported plugin exports.
- `packages/player/src/index.core.ts` is the public core-only surface.
- `packages/player/src/index.embed.ts` is the opinionated embed entry that pre-registers a default plugin set.
- Publicly supported plugins are the ones exported from `packages/player/src/index.plugins.ts`.
- Media sources are configured through `sources`, where each item can be a URL string or an object with `source` and `mimeType`.
- `priorityTransport` influences source ordering when multiple compatible sources are available.
- `playbackType` is important for UX behavior. It should only be forced when the stream type is known in advance.

## API surface overview

Core SDK concepts:

- `Player`: create, attach, destroy, load, and control playback
- `PlayerConfig`: configure sources, autoplay, mute, language, loop, debug, transport preference, and plugin settings
- `PlayerEvent`: top-level events such as `ready`, `play`, `pause`, `timeupdate`, `error`, and `fullscreen`
- `Player.registerPlugin(...)`: opt into the built-in plugin model or add custom plugins

Top-level built-in capabilities exposed as plugins include:

- media controls
- subtitles and audio track selection
- quality selection
- playback speed
- picture-in-picture
- thumbnails and posters
- DVR controls
- multi-camera switching
- logo and share actions
- telemetry and CMCD configuration

## Detailed docs

- Architecture and deep technical detail: [docs/architecture.md](./docs/architecture.md)
- Code map: [docs/codemap.md](./docs/codemap.md)
- Install and configure guide: [docs/install-and-configure.md](./docs/install-and-configure.md)
- Quick start guide: [docs/quick-start.md](./docs/quick-start.md)
- Generated API reference: [packages/player/docs/api/player.md](./packages/player/docs/api/player.md)
- Human-facing overview of product value and usage: [README.md](./README.md)
