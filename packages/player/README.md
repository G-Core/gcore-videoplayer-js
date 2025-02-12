# Gcore video player

## Installation

```bash
npm install @gcorevideo/player
```

See also the [plugins package](../player-plugins/README.md) which almost always accompanies the player.

## Usage

```ts
import { Player } from '@gcorevideo/player'

import { MyFancyPlugin } from './plugins/my-fancy-plugin'

Player.registerPlugin(MyFancyPlugin)

const player = new Player({
  autoPlay: true,
  mute: true,
  sources: [
    {
      source: 'https://example.com/myownair66.mpd',
      mimeType: 'application/dash+xml',
    },
  ],
  myFancyPlugin: {
    color: 'rainbow',
  },
})

document.addEventListener('DOMContentLoaded', () => {
  player.attachTo(document.getElementById('video-container'))
})
```

See the complete example app on Vercel: [https://github.com/dmitritz/gcore-videoplayer-js-nuxt](https://github.com/dmitritz/gcore-videoplayer-js-nuxt)

### Plain HTML example

```html
<html>
<head>
    <link rel="stylesheet" href="https://player.gvideo.co/v2/assets/player-plugins/0.9.0/index.css" />
    ...
</head>
<body>
<script type="module">
  import {
    Player,
  } from 'https://player.gvideo.co/v2/assets/player/2.16.7/index.js'
  import {
    MediaControl,
    SourceController,
    Spinner,
  } from 'https://player.gvideo.co/v2/assets/player-plugins/0.10.2/index.js'
  Player.registerPlugin(MediaControl)
  Player.registerPlugin(SourceController)
  Player.registerPlugin(Spinner)
  const player = new Player({
    autoPlay: true,
    mute: true,
    sources: [{
      source: 'https://demopage.gcdn.co/cmaf/2675_19146/index.mpd',
      type: 'application/dash+xml',
    }, {
      source: 'https://demopage.gcdn.co/cmaf/2675_19146/master.m3u8',
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
<div id="wrapper" style="max-width: 400px;margin: 1rem auto;">
  <div id="container" style="width: 100%;height: 0;padding-bottom: 56.25%;position: relative;background-color: black;color: #fff;"></div>
</div>
</body>
</html>
```

[Example codepen](https://codepen.io/dmitritz/pen/OPLdEab)

See the complete example app on Vercel: [https://github.com/dmitritz/gcore-videoplayer-js-nuxt](https://github.com/dmitritz/gcore-videoplayer-js-nuxt)

## Documentation

- [API reference](./docs/api/index.md)
