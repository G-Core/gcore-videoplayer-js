# Gcore video player

## Installation

```bash
npm install @gcorevideo/player
```

## Usage

```ts
import { Player } from '@gcorevideo/player'

import { MyFancyPlugin } from './plugins/my-fancy-plugin'

Player.registerPlugin(MyFancyPlugin)

const player = new Player({
  autoPlay: true,
  mute: true,
  sources: [{
    source: 'https://example.com/myownair66.mpd',
    mimeType: 'application/dash+xml',
  }],
  myFancyPlugin: {
    color: 'rainbow',
  }
})

document.addEventListener('DOMContentLoaded', () => {
    player.attachTo(document.getElementById('video-container'))
})
```

See the complete example app on Vercel: [https://github.com/dmitritz/gcore-videoplayer-js-nuxt](https://github.com/dmitritz/gcore-videoplayer-js-nuxt)

## Documentation

- [API reference](./docs/api/index.md)
