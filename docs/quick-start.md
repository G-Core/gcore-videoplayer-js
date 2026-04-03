# Quick Start Guide

This guide is a repo-local quick-start based on the Gcore product tutorial:

- <https://gcore.com/docs/streaming/api/player-api-tutorial>

It keeps the same high-level section structure, but the content is rewritten for this repository and for AI agents working from local docs.

## Demo links

- Full demo with plugin settings: <https://gcore-videoplayer-js-nuxt.vercel.app/settings>
- Native JS demo: <https://codepen.io/dmitritz/pen/OPLdEab?editors=1000>

Real demo media URLs used in the product docs:

- Live HLS MPEG-TS: `https://demo-public.gvideo.io/mpegts/2675_19146/master_mpegts.m3u8`
- Live HLS CMAF: `https://demo-public.gvideo.io/cmaf/2675_19146/master.m3u8`
- Live DASH CMAF: `https://demo-public.gvideo.io/cmaf/2675_19146/index.mpd`
- VOD HLS MPEG-TS: `https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.m3u8`
- VOD HLS CMAF: `https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master-cmaf.m3u8`
- VOD DASH CMAF: `https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.mpd`


## Basic functions

Use a single `PlayerConfig` object to control the essentials:

- define one source or several fallback sources
- autoplay on load
- loop VOD playback
- start muted
- show a poster image before playback begins

### Single-source playback

Live HLS:

```ts
const player = new Player({
  autoPlay: true,
  mute: true,
  sources: ['https://demo.gvideo.io/cmaf/2675_19146/master.m3u8'],
})
```

VOD HLS:

```ts
const player = new Player({
  autoPlay: true,
  mute: true,
  sources: [
    'https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.m3u8',
  ],
})
```

### Multi-source playback and transport preference

Use multiple sources when you want preferred delivery plus fallback behavior.

```ts
const player = new Player({
  autoPlay: true,
  mute: true,
  playbackType: 'live',
  priorityTransport: 'dash',
  sources: [
    {
      source: 'https://demo-public.gvideo.io/cmaf/2675_19146/index.mpd',
      mimeType: 'application/dash+xml',
    },
    {
      source: 'https://demo.gvideo.io/cmaf/2675_19146/master.m3u8',
      mimeType: 'application/x-mpegurl',
    },
  ],
  poster: {
    url: 'https://static.gvideo.co/videoplatform/posters/video/11452407/eb4fba797fc1f41309e5b0b552319208.jpeg',
  },
})
```

### Autoplay

```ts
const player = new Player({
  autoPlay: true,
  mute: true,
  sources: [
    'https://demo-public.gvideo.io/videos/2675_mvsPGvDVx0Hzbog/master.m3u8',
  ],
})
```

### Loop playback

```ts
const player = new Player({
  loop: true,
  playbackType: 'vod',
  sources: [
    'https://demo-public.gvideo.io/videos/2675_mvsPGvDVx0Hzbog/master.m3u8',
  ],
})
```

### Mute on start

```ts
const player = new Player({
  mute: true,
  sources: [
    'https://demo-public.gvideo.io/videos/2675_mvsPGvDVx0Hzbog/master.m3u8',
  ],
})
```

### Poster thumbnail

```ts
const player = new Player({
  sources: [
    'https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.m3u8',
  ],
  poster: {
    url: 'https://static.gvideo.co/videoplatform/posters/video/11452143/6423b07877c27c372b205aa99fd13f42.jpeg',
    showForNoOp: true,
  },
})
```

## How to customize

Customization is one of the main reasons to use the SDK instead of a fixed embed.

### Custom skin

The player UI is plugin-based, so styling usually starts with CSS targeting the rendered UI classes. Common customization areas are:

- bottom control panel background
- icon and timeline colors
- text colors
- hover states

Base stylesheet:

- `https://player.gvideo.co/v2/assets/latest/index.css`

### Hide or replace UI components

The interface is modular. Most visible UI comes from plugins, especially `MediaControl` and related UI plugins. Practical approaches:

- register only the plugins you need
- disable or omit built-in UI layers when building a custom interface
- keep playback in the SDK and build product-specific controls on top of `Player` methods and events

### CMCD usage

Use the `CmcdConfig` plugin when you want to pass Common Media Client Data with playback requests.

```ts
import { Player, CmcdConfig } from '@gcorevideo/player'

Player.registerPlugin(CmcdConfig)

const vodUrl =
  'https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.m3u8'

function extractVodSlug(url: string) {
  const match = new URL(url).pathname.match(/\/videos\/\d+_([^/]+)\//)
  return match?.[1] ?? new URL(url).pathname
}

const sessionId = crypto.randomUUID()
const contentId = extractVodSlug(vodUrl) // w6nGXEimHz4Z6t1j

const player = new Player({
  sources: [vodUrl],
  cmcd: {
    sessionId,
    contentId,
  },
})
```

If `sessionId` is omitted, the plugin generates a random UUID automatically. If `contentId` is omitted, the plugin falls back to the pathname of the first source URL.

CMCD plugin API:

- [packages/player/docs/api/player.cmcdconfig.md](../packages/player/docs/api/player.cmcdconfig.md)

## Methods overview

Once initialized, the player exposes a compact control surface.

### Playback control

- `player.play()`: start playback
- `player.pause()`: pause playback
- `player.stop()`: stop playback

### Mute and volume

- `player.mute()`: mute audio
- `player.unmute()`: unmute audio
- `player.setVolume(0.5)`: set volume from `0` to `1`
- `player.isMuted()`: check muted state
- `player.getVolume()`: get current volume

### Seek and timing

- `player.getCurrentTime()`: current playback position in seconds
- `player.getDuration()`: total duration in seconds
- `player.seek(120)`: jump to a given second

### Lifecycle

- `player.destroy()`: release resources before removing the player from the DOM

Full API:

- [packages/player/docs/api/player.md](../packages/player/docs/api/player.md)

## Events overview

The player emits high-level lifecycle and playback events for UI integration and analytics.

Example:

```ts
player.on('play', () => {
  // playback started
})
```

Common events:

- `ready`: player initialized and ready
- `play`: playback started
- `pause`: playback paused
- `seek`: time changed by user action or code
- `timeupdate`: playback time updated
- `volumeupdate`: volume or mute state changed
- `fullscreen`: fullscreen toggled
- `error`: playback failed or source could not be loaded

Full event reference:

- [packages/player/docs/api/player.playerevent.md](../packages/player/docs/api/player.playerevent.md)

## Errors overview

Playback failures are exposed through the `error` event and a structured `PlaybackError` object.

Example:

```ts
player.on('error', (error) => {
  console.warn('Playback error:', error.message)
})
```

Typical causes:

- invalid or unreachable source URLs
- broken media metadata
- unsupported formats or codec combinations

Practical handling:

- show fallback UI
- retry playback when appropriate
- switch to a backup source
- use `SourceController` to automate source failover

Error reference:

- [packages/player/docs/api/player.playbackerror.md](../packages/player/docs/api/player.playbackerror.md)

## Debug overview

When playback does not start or behaves unexpectedly, enable logs and tracing.

```ts
import { Logger, LogTracer, setTracer } from '@gcorevideo/player'

Logger.enable('*')
setTracer(new LogTracer('your-app-name'))
```

This helps inspect:

- player lifecycle flow
- source selection
- buffering behavior
- playback and network errors

For production observability, the SDK also supports remote tracing and integrations such as Sentry through the exported tracing utilities and related plugins.

## Missing the feature you need?

Gcore is highly customer-oriented. If a capability is missing, that usually means there has not yet been a requirement to implement it. The player can be adapted to customer needs, so if you need something beyond the current feature set, contact Gcore to discuss the right solution.
