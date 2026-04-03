# Code Examples and Recipes

Practical copy-paste examples for integrating the Gcore JavaScript Video Player SDK.

For installation and configuration reference, see [docs/install-and-configure.md](./docs/install-and-configure.md).
For framework-specific integration patterns, see [docs/framework-integration.md](./docs/framework-integration.md).

---

## Vanilla JavaScript

### Minimal working player

The smallest possible integration — one source, autoplay muted, no plugins except the control bar.

```html
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="https://player.gvideo.co/v2/assets/latest/index.css" />
  </head>
  <body>
    <div id="player" style="width: 640px; height: 360px;"></div>

    <script type="module">
      import { Player, MediaControl, SourceController } from 'https://player.gvideo.co/v2/assets/latest/index.js'

      Player.registerPlugin(MediaControl)
      Player.registerPlugin(SourceController)

      const player = new Player({
        autoPlay: true,
        mute: true,
        sources: ['https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.m3u8'],
      })

      player.attachTo(document.getElementById('player'))
    </script>
  </body>
</html>
```

### Full plugin stack

Register the most common plugins for a production-grade player UI.

```ts
import '@gcorevideo/player/dist/index.css'
import {
  Player,
  MediaControl,
  SourceController,
  QualityLevels,
  AudioTracks,
  ClosedCaptions,
  PlaybackRate,
  PictureInPicture,
  Poster,
  SpinnerThreeBounce,
  ErrorScreen,
  Thumbnails,
} from '@gcorevideo/player'

Player.registerPlugin(MediaControl)
Player.registerPlugin(SourceController)
Player.registerPlugin(QualityLevels)
Player.registerPlugin(AudioTracks)
Player.registerPlugin(ClosedCaptions)
Player.registerPlugin(PlaybackRate)
Player.registerPlugin(PictureInPicture)
Player.registerPlugin(Poster)
Player.registerPlugin(SpinnerThreeBounce)
Player.registerPlugin(ErrorScreen)
Player.registerPlugin(Thumbnails)

const player = new Player({
  autoPlay: true,
  mute: true,
  playbackType: 'vod',
  sources: [
    {
      source: 'https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.mpd',
      mimeType: 'application/dash+xml',
    },
    {
      source: 'https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.m3u8',
      mimeType: 'application/x-mpegurl',
    },
  ],
  poster: {
    url: 'https://static.gvideo.co/videoplatform/posters/video/11452143/6423b07877c27c372b205aa99fd13f42.jpeg',
  },
})

player.attachTo(document.getElementById('player')!)
```

### Listening to events

```ts
import { Player, PlayerEvent } from '@gcorevideo/player'

const player = new Player({ sources: ['https://example.com/video.m3u8'] })

player.on(PlayerEvent.Ready, () => {
  console.log('Player ready, duration:', player.getDuration())
})

player.on(PlayerEvent.Play, () => {
  console.log('Playing at:', player.getCurrentTime())
})

player.on(PlayerEvent.TimeUpdate, ({ current, total }) => {
  console.log(`${current.toFixed(1)} / ${total.toFixed(1)}s`)
})

player.on(PlayerEvent.Error, (error) => {
  console.error('Playback error:', error.message, error.code)
})

player.on(PlayerEvent.Ended, () => {
  console.log('Playback ended')
  player.seek(0)
  player.play()
})

player.attachTo(document.getElementById('player')!)
```

### Custom controls (headless mode)

Build your own UI using player methods — hide all built-in controls.

```ts
import { Player, SourceController } from '@gcorevideo/player'

// Only register SourceController for failover; skip MediaControl and other UI plugins
Player.registerPlugin(SourceController)

const player = new Player({
  autoPlay: false,
  mute: false,
  sources: ['https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.m3u8'],
})

player.attachTo(document.getElementById('player')!)

// Wire your own buttons to player methods
document.getElementById('btn-play')!.addEventListener('click', () => player.play())
document.getElementById('btn-pause')!.addEventListener('click', () => player.pause())
document.getElementById('btn-mute')!.addEventListener('click', () => {
  player.isMuted() ? player.unmute() : player.mute()
})

const seekBar = document.getElementById('seek-bar') as HTMLInputElement
player.on('timeupdate', ({ current, total }) => {
  seekBar.value = String((current / total) * 100)
})
seekBar.addEventListener('input', () => {
  player.seek((Number(seekBar.value) / 100) * player.getDuration())
})
```

### Swapping sources without destroying the player

```ts
const player = new Player({
  sources: ['https://example.com/stream1.m3u8'],
})
player.attachTo(document.getElementById('player')!)

// Later — load a new source into the same player instance
player.load([
  {
    source: 'https://example.com/stream2.mpd',
    mimeType: 'application/dash+xml',
  },
])
```

### Multi-source with failover

`SourceController` automatically switches to the next source when the current one fails.

```ts
import { Player, SourceController, MediaControl } from '@gcorevideo/player'

Player.registerPlugin(SourceController)
Player.registerPlugin(MediaControl)

const player = new Player({
  autoPlay: true,
  mute: true,
  playbackType: 'live',
  priorityTransport: 'dash',
  sources: [
    { source: 'https://primary.example.com/live.mpd', mimeType: 'application/dash+xml' },
    { source: 'https://primary.example.com/live.m3u8', mimeType: 'application/x-mpegurl' },
    { source: 'https://backup.example.com/live.m3u8', mimeType: 'application/x-mpegurl' },
  ],
})

player.attachTo(document.getElementById('player')!)
```

### DVR live stream

```ts
import { Player, MediaControl, SourceController, DvrControls } from '@gcorevideo/player'

Player.registerPlugin(MediaControl)
Player.registerPlugin(SourceController)
Player.registerPlugin(DvrControls)

const player = new Player({
  autoPlay: true,
  mute: true,
  playbackType: 'live',
  sources: [
    { source: 'https://demo-public.gvideo.io/cmaf/2675_19146/index.mpd', mimeType: 'application/dash+xml' },
    { source: 'https://demo-public.gvideo.io/cmaf/2675_19146/master.m3u8', mimeType: 'application/x-mpegurl' },
  ],
})

player.attachTo(document.getElementById('player')!)
```

### Poster image

```ts
import { Player, Poster, MediaControl, SourceController } from '@gcorevideo/player'

Player.registerPlugin(Poster)
Player.registerPlugin(MediaControl)
Player.registerPlugin(SourceController)

const player = new Player({
  sources: ['https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.m3u8'],
  poster: {
    url: 'https://static.gvideo.co/videoplatform/posters/video/11452143/6423b07877c27c372b205aa99fd13f42.jpeg',
    showForNoOp: true,
    showOnVideoEnd: true,
  },
})

player.attachTo(document.getElementById('player')!)
```

### Subtitles / closed captions

```ts
import { Player, MediaControl, SourceController, ClosedCaptions } from '@gcorevideo/player'

Player.registerPlugin(MediaControl)
Player.registerPlugin(SourceController)
Player.registerPlugin(ClosedCaptions)

const player = new Player({
  sources: ['https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.m3u8'],
})

player.attachTo(document.getElementById('player')!)
```

### Localization

```ts
const player = new Player({
  language: 'es',
  strings: {
    es: {
      play: 'Reproducir',
      pause: 'Pausar',
      mute: 'Silenciar',
      unmute: 'Activar sonido',
      fullscreen: 'Pantalla completa',
    },
  },
  sources: ['https://example.com/video.m3u8'],
})
```

### Analytics — Google Analytics

```ts
import { Player, GoogleAnalytics } from '@gcorevideo/player'

Player.registerPlugin(GoogleAnalytics)

const player = new Player({
  sources: ['https://example.com/video.m3u8'],
  googleAnalytics: {
    trackingId: 'G-XXXXXXXXXX',
  },
})

player.attachTo(document.getElementById('player')!)
```

### Analytics — CMCD

```ts
import { Player, CmcdConfig } from '@gcorevideo/player'

Player.registerPlugin(CmcdConfig)

const player = new Player({
  sources: ['https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.m3u8'],
  cmcd: {
    sessionId: crypto.randomUUID(),
    contentId: 'my-video-id',
  },
})

player.attachTo(document.getElementById('player')!)
```

### Debug logging

```ts
import { Player, Logger, LogTracer, setTracer } from '@gcorevideo/player'

Logger.enable('*')
setTracer(new LogTracer('my-app'))

const player = new Player({
  debug: 'all',
  sources: ['https://example.com/video.m3u8'],
})

player.attachTo(document.getElementById('player')!)
```

---

## Framework integrations

See [docs/framework-integration.md](./docs/framework-integration.md) for:

- React — `useEffect` hook with cleanup
- Vue 3 — composable with `onMounted` / `onUnmounted`
- Next.js — dynamic import with SSR disabled
- Nuxt 3 — client-only component
