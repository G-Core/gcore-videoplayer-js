# Architecture

## Goal

The JavaScript player SDK exists to give Gcore Video Streaming customers a web player that can be integrated as part of their own application UI instead of being isolated inside an iframe.

That changes the job of the player:

- playback still has to be reliable for live and VOD
- the player must expose a stable JavaScript API
- product teams need to extend the experience without forking the core

## Runtime layers

### 1. Public SDK layer

Main files:

- `packages/player/src/index.ts`
- `packages/player/src/index.core.ts`
- `packages/player/src/index.plugins.ts`
- `packages/player/src/types.ts`
- `packages/player/src/playback.types.ts`

This layer defines what consumers import: the `Player` class, public config and event types, playback error types, version, logging utilities, and the built-in plugin exports.

### 2. Player orchestration layer

Main file:

- `packages/player/src/Player.ts`

Responsibilities:

- merge and normalize config
- attach the player to a DOM node
- register configured plugins and playback modules
- translate Clappr/core events into SDK-level player events
- expose the top-level control API such as `play`, `pause`, `seek`, `load`, `mute`, `resize`, and `destroy`

This is the main boundary between application code and the underlying playback/runtime internals.

### 3. Playback layer

Main files:

- `packages/player/src/playback/index.ts`
- `packages/player/src/playback/HTML5Video.ts`
- `packages/player/src/playback/hls-playback/HlsPlayback.ts`
- `packages/player/src/playback/dash-playback/DashPlayback.ts`

Responsibilities:

- register playback engines with Clappr
- decide which engine can play which source
- bridge the SDK into `hls.js`, `dashjs`, or plain HTML5 video playback

Supported source families in the current public surface:

- HLS via `.m3u8`
- MPEG-DASH via `.mpd`
- MP4 through HTML5 video playback

### 4. Plugin layer

Main path:

- `packages/player/src/plugins/`

The plugin layer is how the SDK stays flexible without overloading the `Player` class. Features such as media controls, subtitles, audio track selection, quality levels, thumbnails, playback rate, PiP, DVR controls, source failover, and telemetry are implemented as plugins.

There are three practical plugin groups in the codebase:

- UX and controls
- playback-adjacent features
- analytics and observability

The public plugin set is defined by `packages/player/src/index.plugins.ts`.

### 5. Shared utility layer

Main package:

- `packages/utils`

Responsibilities:

- logging and tracing
- remote tracing and Sentry-oriented helpers
- shared utilities used by the player package

## Initialization flow

1. Application code imports `Player` and the desired plugins.
2. Plugins are registered through `Player.registerPlugin(...)`.
3. The app creates a `Player` instance with `sources` and playback config.
4. `attachTo()` binds the runtime to a DOM element.
5. Playback modules are registered and the best playable source is selected.
6. Clappr core and container lifecycle starts.
7. SDK-level events are emitted to the application layer.

The embed entry point in `packages/player/src/index.embed.ts` is an opinionated wrapper around the same runtime. It pre-registers a default plugin set and initializes the player with embed-friendly defaults such as `autoPlay: true` and `mute: true`.

## Source model and transport selection

The player accepts an ordered list of `sources`. Each source may be:

- a raw URL string
- an object with `source` and `mimeType`

Source preparation happens in:

- `packages/player/src/utils/mediaSources.ts`

Important behavior:

- MIME type can be inferred from `.mpd` and `.m3u8` file extensions
- playback engines are asked whether they can play each source
- `priorityTransport` biases selection when both HLS and DASH are available
- `SourceController` provides runtime source switching and failover behavior

## Public API model

The core API is intentionally small:

- lifecycle: `attachTo`, `destroy`, `configure`
- control: `play`, `pause`, `stop`, `seek`, `mute`, `unmute`, `setVolume`
- inspection: `isPlaying`, `isMuted`, `getCurrentTime`, `getDuration`, `isDvrEnabled`, `isDvrInUse`
- content loading: `load`
- integration: `on`, `off`, `registerPlugin`, `unregisterPlugin`

This keeps the application-facing API simple while pushing richer behavior into the plugin model.

## Events and application integration

The SDK emits high-level events such as:

- `ready`
- `play`
- `pause`
- `ended`
- `seek`
- `timeupdate`
- `volumeupdate`
- `resize`
- `fullscreen`
- `error`

This makes the player usable as part of a larger web application state model without forcing consumers to subscribe directly to Clappr internals.

## Observability and diagnostics

Observability is split between public logging/tracing utilities and plugins:

- logging and tracers are exported from `@gcorevideo/utils` through the player package
- telemetry and stats plugins can collect operational and UX-relevant playback signals
- CMCD configuration is exposed through a dedicated plugin

For deeper API details, use the generated reference in `packages/player/docs/api/`.
