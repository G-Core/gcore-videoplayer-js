# GitHub Copilot Instructions

This repository is the Gcore JavaScript Video Player SDK (`@gcorevideo/player`).
A TypeScript SDK for embedding HLS, MPEG-DASH, and MP4 video playback into web applications.
Built on Clappr. Plugin-based architecture.

## Critical patterns — always generate these correctly

### Plugin registration must precede player instantiation

```ts
// CORRECT
Player.registerPlugin(MediaControl)
Player.registerPlugin(SourceController)
const player = new Player({ sources: [...] })

// WRONG — plugins registered after construction have no effect
const player = new Player({ sources: [...] })
Player.registerPlugin(MediaControl)
```

### Always pair autoPlay with mute

```ts
// CORRECT — browsers block autoplay with sound
new Player({ autoPlay: true, mute: true, sources: [...] })

// WRONG — will be blocked by browser autoplay policy
new Player({ autoPlay: true, sources: [...] })
```

### Always call destroy() on cleanup

```ts
// React
useEffect(() => {
  const player = new Player(config)
  player.attachTo(ref.current!)
  return () => player.destroy()  // REQUIRED
}, [])

// Vue
onUnmounted(() => player.destroy())
```

### CSS must be imported

```ts
import '@gcorevideo/player/dist/index.css'
```

### Container element must have real dimensions

```html
<!-- The player won't render without explicit width and height -->
<div id="player" style="width: 640px; height: 360px;"></div>
```

## Project structure

```
packages/
  player/
    src/
      Player.ts              # Main Player class — public API
      types.ts               # All public TypeScript types
      index.ts               # Main package entry
      index.plugins.ts       # All plugin exports
      plugins/               # 20+ plugin implementations
      playback/              # HLS, DASH, HTML5 engines
    docs/api/                # Generated API reference
  utils/                     # Shared utilities (@gcorevideo/utils)
```

## TypeScript conventions

- All new code must have proper types — avoid `any`, use `unknown` with type guards
- Public types are in `types.ts` — export from there
- Internal types belong in `internal.types.ts`
- Plugin config interfaces follow the pattern `[PluginName]PluginSettings` or `[PluginName]Settings`

## Plugin structure

```ts
import { UICorePlugin, Events } from '@clappr/core'

export class MyPlugin extends UICorePlugin {
  name = 'my_plugin'          // used as PlayerConfig key for plugin options
  static type = 'core'        // or 'container'

  bindEvents() {
    this.listenTo(this.core, Events.PLAYER_PLAY, this.onPlay)
  }

  private onPlay() { /* ... */ }
}
```

- Extend `UICorePlugin` or `ContainerPlugin` from `@clappr/core`
- Use `this.listenTo()` for event binding — it auto-cleans up
- Templates: `assets/[plugin-name]/template.ejs`
- Styles: `assets/[plugin-name]/[plugin-name].scss`
- Plugin config accessed via `this.options.[pluginName]`

## API surface

```ts
// Lifecycle
player.attachTo(element: HTMLElement): void
player.destroy(): void
player.configure(config: Partial<PlayerConfig>): void

// Playback control
player.play(): void
player.pause(): void
player.stop(): void
player.seek(seconds: number): void
player.load(sources: PlayerMediaSource[]): void

// State
player.isPlaying(): boolean
player.isMuted(): boolean
player.getCurrentTime(): number
player.getDuration(): number
player.isDvrEnabled(): boolean

// Audio
player.mute(): void
player.unmute(): void
player.setVolume(volume: number): void  // 0..1

// Events
player.on(event: PlayerEvent, handler): void
player.off(event: PlayerEvent, handler): void
```

## Events

```ts
import { PlayerEvent } from '@gcorevideo/player'

PlayerEvent.Ready        // player initialized
PlayerEvent.Play         // playback started
PlayerEvent.Pause        // playback paused
PlayerEvent.Ended        // reached end
PlayerEvent.Stop         // stopped
PlayerEvent.Seek         // position changed — handler(seconds: number)
PlayerEvent.TimeUpdate   // tick — handler({ current, total }: TimePosition)
PlayerEvent.VolumeUpdate // volume/mute changed — handler(volume: number)
PlayerEvent.Fullscreen   // toggled — handler(isFullscreen: boolean)
PlayerEvent.Resize       // container resized — handler({ width, height })
PlayerEvent.Error        // playback failed — handler(error: PlaybackError)
```

## What NOT to do

- Do not modify Clappr core behavior directly
- Do not use jQuery (Clappr uses Zepto `$`)
- Do not break backward compatibility on public APIs
- Do not add plugins to `PlayerConfig` — configure them via their options key
- Do not commit without running `npm test` and `npm run lint`
- Do not add `any` types — use `unknown` and type guards
- Do not reference one plugin directly from another — use Clappr events for communication

## Source config

```ts
// String shorthand — MIME type inferred from extension
sources: ['https://example.com/video.m3u8']

// Full form — explicit MIME type
sources: [
  { source: 'https://example.com/video.mpd', mimeType: 'application/dash+xml' },
  { source: 'https://example.com/video.m3u8', mimeType: 'application/x-mpegurl' },
]
```

MIME type map:
- HLS: `application/x-mpegurl` or `application/vnd.apple.mpegurl`
- DASH: `application/dash+xml`
- MP4: `video/mp4`

## Testing

- Framework: Vitest with happy-dom
- Mock external deps: `dash.js`, `hls.js`, browser APIs
- Test public API and events, not Clappr internals
- Run: `npm test` (from `packages/player`)

## Debug logging

```ts
import { Logger, LogTracer, setTracer } from '@gcorevideo/player'

Logger.enable('*')
setTracer(new LogTracer('app-name'))
```

## Key documentation

- Full examples: `EXAMPLES.md`
- Framework integration (React/Vue/Next.js): `docs/framework-integration.md`
- AI development guide: `AI-DEVELOPMENT.md`
- Architecture: `docs/architecture.md`
- API reference: `packages/player/docs/api/player.md`
- PlayerConfig schema: `docs/player-config.schema.json`
