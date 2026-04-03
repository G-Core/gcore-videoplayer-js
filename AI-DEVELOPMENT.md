# AI-Assisted Development Guide

This guide is for developers using AI coding tools — Claude Code, GitHub Copilot, Cursor, ChatGPT/Codex — to work with the Gcore JavaScript Video Player SDK.

For AI agents working directly in this repository, see [CLAUDE.md](./CLAUDE.md).

---

## Quick orientation

**What this repo is**: A JavaScript/TypeScript SDK (`@gcorevideo/player`) for embedding video playback into web applications. Built on Clappr, supports HLS, MPEG-DASH, and MP4.

**The three things you always need to know:**
1. Plugins must be registered globally before any player is created: `Player.registerPlugin(MyPlugin)`
2. The player attaches to a DOM element: `player.attachTo(element)`
3. Every option lives in a single `PlayerConfig` object passed to the constructor

**Key files for AI context:**
- [CLAUDE.md](./CLAUDE.md) — project rules and behavioral instructions
- [DOCS.md](./DOCS.md) — architecture and project knowledge
- [EXAMPLES.md](./EXAMPLES.md) — copy-paste code recipes
- [docs/quick-start.md](./docs/quick-start.md) — minimal working examples
- [docs/install-and-configure.md](./docs/install-and-configure.md) — installation guide
- [docs/framework-integration.md](./docs/framework-integration.md) — React, Vue, Next.js
- [packages/player/src/types.ts](./packages/player/src/types.ts) — all public types
- [packages/player/docs/api/player.md](./packages/player/docs/api/player.md) — generated API reference

---

## Prompts that work well

These prompts are optimized to give AI tools the right context to generate accurate code.

### Install and set up

```
I'm integrating @gcorevideo/player into a [React/Vue/Next.js/vanilla JS] project.
Show me how to:
1. Install the package
2. Register the standard plugins
3. Create a player that autoplays a muted HLS stream
4. Clean up the player when the component unmounts

Use TypeScript. The container div already exists in the DOM as #player-container.
```

### Add a specific plugin

```
I have a working Gcore player:
  Player.registerPlugin(MediaControl)
  Player.registerPlugin(SourceController)
  const player = new Player({ sources: ['...'] })

I want to add [subtitles / quality selector / picture-in-picture / DVR controls].
Show me exactly which import to add, how to register the plugin,
and any config options I need to pass in PlayerConfig.
```

### Build custom controls

```
I'm using @gcorevideo/player and want to build my own play/pause/seek UI
instead of the built-in MediaControl plugin.

Show me:
- Which plugins to skip registering
- How to wire a custom play button, pause button, seek slider, and time display
- Which player events give me current time and duration
- TypeScript types for the event callbacks
```

### Handle errors and fallback

```
Using @gcorevideo/player, show me how to:
1. Listen for playback errors using the error event
2. Distinguish recoverable vs fatal errors
3. Show a fallback UI when playback fails
4. Retry with a backup source URL

Use the PlayerEvent enum for event names.
```

### Live stream with DVR

```
Set up @gcorevideo/player for a live stream that supports DVR seeking.
The stream is available as both DASH and HLS. Show me the full
PlayerConfig including playbackType, priorityTransport, and the
DvrControls plugin registration.
```

### Debug a player that won't start

```
My @gcorevideo/player instance attaches to the DOM but nothing plays.
Show me how to enable debug logging to diagnose:
- Source selection
- Playback engine initialization
- Network errors

Include Logger.enable and setTracer setup.
```

---

## Common AI mistakes — and how to correct them

### Mistake: Instantiating the player before plugins are registered

**Wrong:**
```ts
const player = new Player({ sources: [...] })
Player.registerPlugin(MediaControl) // too late
```

**Correct:**
```ts
Player.registerPlugin(MediaControl) // must come first
Player.registerPlugin(SourceController)
const player = new Player({ sources: [...] })
```

### Mistake: Attaching before DOM is ready

**Wrong:**
```ts
const player = new Player({ sources: [...] })
player.attachTo(document.getElementById('player')) // may be null
```

**Correct:**
```ts
document.addEventListener('DOMContentLoaded', () => {
  player.attachTo(document.getElementById('player')!)
})
```

### Mistake: Not destroying the player on unmount (React)

**Wrong:**
```tsx
useEffect(() => {
  player.attachTo(ref.current!)
  // missing cleanup
}, [])
```

**Correct:**
```tsx
useEffect(() => {
  player.attachTo(ref.current!)
  return () => player.destroy()
}, [])
```

### Mistake: Calling `autoPlay: true` without `mute: true`

Browsers block autoplay with sound. Pair them:
```ts
new Player({ autoPlay: true, mute: true, sources: [...] })
```

### Mistake: Re-registering plugins across multiple player instances

`Player.registerPlugin()` is global — call it once at app startup, not inside components.

### Mistake: Forgetting to import the CSS

```ts
// Required — without this, the UI renders unstyled
import '@gcorevideo/player/dist/index.css'
```

---

## AI workflow recipes

### Recipe: Explain what a plugin does

```
In the @gcorevideo/player SDK, what does the [SourceController / DvrControls / CmcdConfig] 
plugin do? What config options does it accept? When should I register it?
```

### Recipe: Generate a React hook

```
Create a custom React hook useGcorePlayer(config: PlayerConfig) that:
- Accepts a ref to the container div
- Registers [list your plugins] once on first render
- Creates and attaches the player when the ref is ready
- Destroys the player on unmount
- Returns the player instance

Use TypeScript. Import types from @gcorevideo/player.
```

### Recipe: Migrate from iframe embed

```
I'm currently using the Gcore iframe player embed. I want to switch to @gcorevideo/player
so I can add custom controls and event tracking. My iframe src is [URL].

Show me the equivalent PlayerConfig and plugin setup to replicate:
- Autoplay muted
- Quality selector
- The same poster image
```

### Recipe: Add event tracking

```
I want to track these player events in my analytics system:
- Video started (first play)
- 25%, 50%, 75%, 100% watched
- Buffering start/end
- Quality level changes
- Errors

Using @gcorevideo/player events and methods, show me how to implement 
this tracking. Include TypeScript types.
```

---

## Codebase navigation for AI agents

When you need to find something in this repo:

| What you want | Where to look |
|---|---|
| All public types | `packages/player/src/types.ts` |
| Player class API | `packages/player/src/Player.ts` |
| All exported plugins | `packages/player/src/index.plugins.ts` |
| A specific plugin | `packages/player/src/plugins/[plugin-name]/` |
| Playback engines | `packages/player/src/playback/` |
| Plugin config types | Look for `[PluginName]Settings` or `[PluginName]PluginSettings` interface in the plugin file |
| Test examples | `packages/player/src/plugins/[name]/__tests__/` |
| Generated API docs | `packages/player/docs/api/` |

### Finding a plugin's config key

Plugin config is passed via `PlayerConfig` under a key that matches the plugin's internal name. The internal name is in `plugin.name`. For example, `Poster` plugin uses `poster: { url: '...' }`.

---

## JSON Schema for PlayerConfig

A machine-readable schema describing all `PlayerConfig` fields is available at:

[docs/player-config.schema.json](./docs/player-config.schema.json)

Use it to:
- Validate config objects at build time
- Generate forms or editors
- Provide structured context to AI tools that support schema-guided generation

---

## Troubleshooting with AI

When pasting errors into an AI tool, include:

1. The full error message and stack trace
2. Your plugin registration code
3. Your `PlayerConfig` object (remove sensitive URLs if needed)
4. The browser and OS

Example prompt structure:
```
I'm using @gcorevideo/player [version] in [React/Vue/vanilla JS].
I get this error: [paste error]
My setup: [paste code]
What's wrong and how do I fix it?
```
