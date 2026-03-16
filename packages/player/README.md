# Gcore video player

$

## Installation

```bash
npm install @gcorevideo/player
```

Or use a script on the CDN directly in your HTML:

```html
<script src="https://player.gvideo.co/v2/assets/2.26.1/index.js"></script>
```

## Usage

See the complete example app on Vercel: <https://github.com/dmitritz/gcore-videoplayer-js-nuxt>

### Plain HTML example

```html
<html>
<head>
    <link rel="stylesheet" href="https://player.gvideo.co/v2/assets/2.26.1/index.css" />
    ...
    <style>
      #container {
        width: 100%;
        height: 0;
        padding-bottom: 56.25%;
        position: relative;
        background-color:black;
        color:#fff
      }
      #wrapper {
        max-width: 400px;
        margin: 1rem auto;
      }
    </style>
</head>
<body>
<div id="wrapper">
  <div id="container"></div>
</div>
<script type="module">
  import {
    Player,
    MediaControl,
    SourceController,
    Spinner,
  } from 'https://player.gvideo.co/v2/assets/2.26.1/index.js'

  Player.registerPlugin(MediaControl)
  Player.registerPlugin(SourceController)
  Player.registerPlugin(Spinner)

  const player = new Player({
    autoPlay: true,
    mute: true,
    sources: [{
      source: 'https://demo-public.gvideo.io/cmaf/2675_21960/index.mpd,
      type: 'application/dash+xml',
    }, {
      source: 'https://demo-public.gvideo.io/cmaf/2675_21960/master.m3u8',
      type: 'application/x-mpegURL',
    }],
    spinner: {
      showOnError: true,
      showOnStart: true,
    }
  })
  document.addEventListener('DOMContentLoaded', () => {
    player.attachTo(document.getElementById('container'))
  })
</script>
</body>
</html>
```

[Example codepen](https://codepen.io/dmitritz/pen/OPLdEab)

## Documentation

- [API reference](./docs/api/index.md)

## Development

### Log level

Detailed logs can be useful in local development while debugging or watching tests output.
Log level of the player core and components can be controlled by configuring a LogTracer:

```ts
import { LogTracer, Logger, setTracer } from '@gcorevideo/utils'
// ...
Logger.enable('*') // log everything; you can use glob-like patterns, such as 'gplayer', 'plugins.*' or 'playback.*'
setTracer(new LogTracer('AudioTracks.test'))
```

When debugging an app that use the player as a dependency,

```ts
import { LogTracer, Logger, setTracer } from '@gcorevideo/player'
```
