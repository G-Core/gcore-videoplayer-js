# Install and Configure

This file is a repo-local, AI-readable guide based on the Gcore product tutorial for the JavaScript Player SDK. It summarizes the install flow, runtime model, and integration paths without requiring an agent to parse the whole product docs page.

Source tutorial:

- <https://gcore.com/docs/streaming/api/player-api-tutorial>

## SDK overview

The SDK is configured through a single `PlayerConfig` object.

## Integration paths

Use one of these two approaches:

1. Framework/bundler integration for React, Vue, Nuxt, Svelte, and similar frontend apps
2. Native JavaScript integration for direct browser usage without package installation

### Framework and bundler usage

Use this path when the player is part of an existing frontend application.

#### Install

```bash
npm install @gcorevideo/player
```

or

```bash
yarn add @gcorevideo/player
```

#### Configure

Import the player stylesheet, import the modules you need, register the plugins, then attach the player to a DOM element with visible dimensions.

```ts
import '@gcorevideo/player/dist/index.css'
import { Player, MediaControl, SourceController } from '@gcorevideo/player'

Player.registerPlugin(MediaControl)
Player.registerPlugin(SourceController)

const player = new Player({
  autoPlay: true,
  mute: true,
  sources: [
    {
      source: 'https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.m3u8',
      mimeType: 'application/x-mpegurl',
    },
  ],
})

player.attachTo(document.getElementById('container')!)
```

#### Container

The container must exist in the DOM and have real width and height.

```html
<div id="container" style="width: 640px; height: 360px;"></div>
```

### Native JavaScript usage

Use this path when you want direct HTML integration without npm or yarn.

#### Load from CDN

```html
<link rel="stylesheet" href="https://player.gvideo.co/v2/assets/latest/index.css" />
<script type="module">
  import {
    Player,
    MediaControl,
    SourceController,
  } from 'https://player.gvideo.co/v2/assets/latest/index.js'

  Player.registerPlugin(MediaControl)
  Player.registerPlugin(SourceController)

  const player = new Player({
    autoPlay: true,
    mute: true,
    sources: [
      {
        source: 'https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.m3u8',
        mimeType: 'application/x-mpegurl',
      },
    ],
  })

  player.attachTo(document.getElementById('container'))
</script>
```

#### Native JS container

```html
<div id="container" style="width: 640px; height: 360px;"></div>
```

## Quick start

Read [quick-start.md](./quick-start.md) for a quick start guide and common use cases.


## Version channel

You can load either:

- a fixed version for production stability and longer QA cycles
- `/latest/` for automatic access to the newest build

Examples:

- `https://player.gvideo.co/v2/assets/latest/index.css`
- `https://player.gvideo.co/v2/assets/latest/index.js`

All published releases:

- <https://github.com/G-Core/gcore-videoplayer-js/releases>

## Practical install notes

- The player is framework-agnostic and can be embedded into React, Vue, Svelte, plain JS, and CMS-driven environments
- Register only the plugins you need for the current integration
- The player can work with any compatible source URL, not only Gcore-hosted media
- For autoplay, pair `autoPlay: true` with `mute: true` to reduce browser policy issues
- For multi-source playback, pass an ordered `sources` list and optionally set `priorityTransport`

## Missing the feature you need?

Gcore is highly customer-oriented. If a capability is missing, that usually means there has not yet been a requirement to implement it. The player can be adapted to customer needs, so if you need something beyond the current feature set, contact Gcore to discuss the right solution.
