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

## HLS.js integration notes

These findings are version-specific. Re-verify them when upgrading `hls.js`.

**Current version: 1.6.15** (`packages/player/package.json`)

### Codec preference scoring

HLS.js has a built-in codec preference table in `src/utils/codecs.ts` (`sampleEntryCodesISO.video`). Lower value = higher priority:

| Codec | Score |
|-------|-------|
| Dolby Vision HEVC (`dvh1`, `dvhe`) | 0.7 |
| HEVC (`hev1`, `hvc1`) | **0.75** |
| AV1 (`av01`) | **0.8** |
| VP9 (`vp09`) | 0.9 |
| H.264 (`avc1`, `avc3`, …) | 1.0 |

**HEVC is preferred over AV1 by default.** For a multi-codec manifest that has the same resolution at both codecs, HLS.js will always start with HEVC unless told otherwise. This is counterintuitive because AV1 delivers better compression at equivalent quality.

The exception is Windows Firefox: `userAgentHevcSupportIsInaccurate()` returns `true` there, which inflates HEVC's score to 9, effectively demoting it below AV1.

### How we override codec preference

`HlsPlayback._applyCodecPreferenceAndReload()` is called on `MANIFEST_PARSED` before `hls.startLoad()`. It:

1. Runs codec detection (via `MediaCapabilities.decodingInfo` for `power-efficient`, or `canPlayType` for `best-supported`).
2. Sets `hls.config.videoPreference = { videoCodec: detectedPrefix }` before `startLoad()`.

HLS.js's `getStartCodecTier` (`src/utils/rendition-helper.ts`) reads `videoPreference.videoCodec` to filter out non-matching codec tiers before the first ABR decision. Once a codec tier is selected, HLS.js's own codec stickiness keeps all subsequent ABR switches within that tier.

**If you upgrade hls.js**, check whether:
- The preference scores in `sampleEntryCodesISO.video` changed (AV1 score decreased below HEVC).
- `videoPreference.videoCodec` still works as a pre-`startLoad` override in `getStartCodecTier`.
- `userAgentHevcSupportIsInaccurate` was broadened to cover more browsers (e.g., Chrome macOS).

If a future hls.js release gives AV1 a lower score than HEVC, our `_applyCodecPreferenceAndReload` logic remains correct but becomes a no-op for `best-supported` on browsers that support AV1 — which is fine.

### `autoStartLoad: false`

The player sets `autoStartLoad: false` in the HLS.js config so it can run `_applyCodecPreferenceAndReload` (and optionally apply other options) before playback starts. `hls.startLoad(-1)` is called explicitly from `reload()` at the end of that method.

## dash.js integration notes

These findings are version-specific. Re-verify them when upgrading `dash.js`.

**Current version: 5.x** (`packages/player/package.json`)

### CMCD `br` reports top bitrate in auto-ABR mode

When dash.js is in automatic ABR mode, the `br` (Encoded Bitrate) field it sends in CMCD query strings equals the **top available representation's `@bandwidth`** from the manifest — not the bitrate of the segment actually being requested.

When a specific quality level is manually locked, `br` correctly reflects that level's declared `@bandwidth`.

This is a dash.js behaviour that diverges from the CTA-5004 spec, which defines `br` as *"the encoded bitrate of the audio or video object being requested"*. It may be a bug or a deliberate design choice in how dash.js tracks representations under ABR control.

**Practical impact:** Do not rely on CMCD `br` to determine which quality is currently playing when dash.js is in auto-ABR mode. Use the `container:bitrate` event or `getCurrentRepresentationForType('video')` instead.

**If you upgrade dash.js**, verify whether `br` in auto-ABR mode now matches the actual requested representation's `@bandwidth`. If it does, the caveat in the lab page's CMCD tooltip can be removed.

## Detailed docs

- Architecture and deep technical detail: [docs/architecture.md](./docs/architecture.md)
- Code map: [docs/codemap.md](./docs/codemap.md)
- Install and configure guide: [docs/install-and-configure.md](./docs/install-and-configure.md)
- Quick start guide: [docs/quick-start.md](./docs/quick-start.md)
- Generated API reference: [packages/player/docs/api/player.md](./packages/player/docs/api/player.md)
- Human-facing overview of product value and usage: [README.md](./README.md)
