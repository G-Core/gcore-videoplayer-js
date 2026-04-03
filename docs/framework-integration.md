# Framework Integration Guide

How to integrate `@gcorevideo/player` into React, Vue 3, Next.js, and Nuxt 3.

For vanilla JavaScript examples, see [EXAMPLES.md](../EXAMPLES.md).

---

## React

### Hook-based integration

Create a reusable hook that manages the player lifecycle.

```tsx
// hooks/useGcorePlayer.ts
import { useEffect, useRef } from 'react'
import {
  Player,
  PlayerConfig,
  PlayerEvent,
  MediaControl,
  SourceController,
} from '@gcorevideo/player'
import '@gcorevideo/player/dist/index.css'

// Register plugins once — outside any component, at module level
Player.registerPlugin(MediaControl)
Player.registerPlugin(SourceController)

export function useGcorePlayer(config: PlayerConfig) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const player = new Player(config)
    player.attachTo(containerRef.current)
    playerRef.current = player

    return () => {
      player.destroy()
      playerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount; pass stable config or use separate effect for source changes

  return { containerRef, player: playerRef }
}
```

```tsx
// components/VideoPlayer.tsx
import { useGcorePlayer } from '../hooks/useGcorePlayer'

export function VideoPlayer({ src }: { src: string }) {
  const { containerRef } = useGcorePlayer({
    autoPlay: true,
    mute: true,
    sources: [src],
  })

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', aspectRatio: '16/9' }}
    />
  )
}
```

### Hook with event callbacks

```tsx
// hooks/useGcorePlayer.ts (extended version)
import { useEffect, useRef, useCallback } from 'react'
import { Player, PlayerConfig, PlayerEvent, PlaybackError } from '@gcorevideo/player'

type PlayerCallbacks = {
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
  onError?: (error: PlaybackError) => void
  onTimeUpdate?: (current: number, total: number) => void
}

export function useGcorePlayer(config: PlayerConfig, callbacks?: PlayerCallbacks) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const player = new Player(config)
    player.attachTo(containerRef.current)
    playerRef.current = player

    if (callbacks?.onPlay) player.on(PlayerEvent.Play, callbacks.onPlay)
    if (callbacks?.onPause) player.on(PlayerEvent.Pause, callbacks.onPause)
    if (callbacks?.onEnded) player.on(PlayerEvent.Ended, callbacks.onEnded)
    if (callbacks?.onError) player.on(PlayerEvent.Error, callbacks.onError)
    if (callbacks?.onTimeUpdate) {
      player.on(PlayerEvent.TimeUpdate, ({ current, total }) => {
        callbacks.onTimeUpdate!(current, total)
      })
    }

    return () => {
      player.destroy()
      playerRef.current = null
    }
  }, []) // intentional: config and callbacks are read once on mount

  const play = useCallback(() => playerRef.current?.play(), [])
  const pause = useCallback(() => playerRef.current?.pause(), [])
  const seek = useCallback((seconds: number) => playerRef.current?.seek(seconds), [])

  return { containerRef, play, pause, seek }
}
```

### Swapping sources reactively

To change the source without destroying and recreating the player:

```tsx
import { useEffect, useRef } from 'react'
import { Player, PlayerConfig, MediaControl, SourceController } from '@gcorevideo/player'
import '@gcorevideo/player/dist/index.css'

Player.registerPlugin(MediaControl)
Player.registerPlugin(SourceController)

export function VideoPlayer({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)

  // Create player once
  useEffect(() => {
    const player = new Player({ autoPlay: true, mute: true, sources: [src] })
    player.attachTo(containerRef.current!)
    playerRef.current = player
    return () => player.destroy()
  }, [])

  // React to src changes
  useEffect(() => {
    playerRef.current?.load([src])
  }, [src])

  return <div ref={containerRef} style={{ width: '100%', aspectRatio: '16/9' }} />
}
```

---

## Vue 3

### Composable

```ts
// composables/useGcorePlayer.ts
import { ref, onMounted, onUnmounted, Ref } from 'vue'
import {
  Player,
  PlayerConfig,
  PlayerEvent,
  MediaControl,
  SourceController,
} from '@gcorevideo/player'
import '@gcorevideo/player/dist/index.css'

Player.registerPlugin(MediaControl)
Player.registerPlugin(SourceController)

export function useGcorePlayer(containerRef: Ref<HTMLElement | null>, config: PlayerConfig) {
  const player = ref<Player | null>(null)

  onMounted(() => {
    if (!containerRef.value) return

    const p = new Player(config)
    p.attachTo(containerRef.value)
    player.value = p
  })

  onUnmounted(() => {
    player.value?.destroy()
    player.value = null
  })

  return { player }
}
```

### Single-file component

```vue
<!-- components/VideoPlayer.vue -->
<template>
  <div ref="playerContainer" class="player-container" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGcorePlayer } from '../composables/useGcorePlayer'

const props = defineProps<{
  src: string
  autoPlay?: boolean
}>()

const playerContainer = ref<HTMLElement | null>(null)

const { player } = useGcorePlayer(playerContainer, {
  autoPlay: props.autoPlay ?? true,
  mute: true,
  sources: [props.src],
})
</script>

<style scoped>
.player-container {
  width: 100%;
  aspect-ratio: 16 / 9;
}
</style>
```

### Reactive source switching

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGcorePlayer } from '../composables/useGcorePlayer'

const props = defineProps<{ src: string }>()
const playerContainer = ref<HTMLElement | null>(null)
const { player } = useGcorePlayer(playerContainer, { sources: [props.src], mute: true })

watch(() => props.src, (newSrc) => {
  player.value?.load([newSrc])
})
</script>
```

---

## Next.js

### Important: SSR

`@gcorevideo/player` is a browser-only library. You must disable SSR for any component that uses it.

### Dynamic import (recommended)

```tsx
// components/VideoPlayer.tsx
'use client'  // App Router: mark as client component

import { useEffect, useRef } from 'react'

// Lazy-load the player — never executed on the server
let playerModulePromise: Promise<typeof import('@gcorevideo/player')> | null = null

function getPlayerModule() {
  if (!playerModulePromise) {
    playerModulePromise = import('@gcorevideo/player')
  }
  return playerModulePromise
}

export function VideoPlayer({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<unknown>(null)

  useEffect(() => {
    let destroyed = false

    getPlayerModule().then(
      ({ Player, MediaControl, SourceController }) => {
        if (destroyed || !containerRef.current) return

        Player.registerPlugin(MediaControl)
        Player.registerPlugin(SourceController)

        const player = new Player({
          autoPlay: true,
          mute: true,
          sources: [src],
        })
        player.attachTo(containerRef.current)
        playerRef.current = player
      }
    )

    return () => {
      destroyed = true
      ;(playerRef.current as { destroy?: () => void })?.destroy?.()
      playerRef.current = null
    }
  }, [src])

  return <div ref={containerRef} style={{ width: '100%', aspectRatio: '16/9' }} />
}
```

```tsx
// app/page.tsx (App Router)
import dynamic from 'next/dynamic'

const VideoPlayer = dynamic(
  () => import('../components/VideoPlayer').then((m) => m.VideoPlayer),
  { ssr: false }
)

export default function Page() {
  return (
    <main>
      <VideoPlayer src="https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.m3u8" />
    </main>
  )
}
```

### Pages Router

```tsx
// pages/video.tsx
import dynamic from 'next/dynamic'

const VideoPlayer = dynamic(() => import('../components/VideoPlayer'), { ssr: false })

export default function VideoPage() {
  return <VideoPlayer src="https://example.com/video.m3u8" />
}
```

### CSS in Next.js

Add the player CSS to your global stylesheet or import it in `_app.tsx` / `layout.tsx`:

```ts
// app/layout.tsx or pages/_app.tsx
import '@gcorevideo/player/dist/index.css'
```

---

## Nuxt 3

### Client-only component

```vue
<!-- components/VideoPlayer.client.vue -->
<!-- The .client.vue suffix ensures this component only renders in the browser -->
<template>
  <div ref="playerContainer" style="width: 100%; aspect-ratio: 16/9;" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { Player as PlayerType } from '@gcorevideo/player'

const props = defineProps<{ src: string }>()
const playerContainer = ref<HTMLElement | null>(null)
let player: PlayerType | null = null

onMounted(async () => {
  const { Player, MediaControl, SourceController } = await import('@gcorevideo/player')
  await import('@gcorevideo/player/dist/index.css')

  Player.registerPlugin(MediaControl)
  Player.registerPlugin(SourceController)

  player = new Player({
    autoPlay: true,
    mute: true,
    sources: [props.src],
  })

  if (playerContainer.value) {
    player.attachTo(playerContainer.value)
  }
})

onUnmounted(() => {
  player?.destroy()
  player = null
})
</script>
```

```vue
<!-- pages/index.vue -->
<template>
  <div>
    <!-- Nuxt automatically skips .client.vue on the server -->
    <VideoPlayer src="https://demo-public.gvideo.io/videos/2675_w6nGXEimHz4Z6t1j/master.m3u8" />
  </div>
</template>
```

### nuxt.config.ts

No special configuration needed. The `.client.vue` naming convention handles SSR exclusion automatically.

---

## Svelte / SvelteKit

```svelte
<!-- VideoPlayer.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { Player as PlayerType } from '@gcorevideo/player'

  export let src: string

  let container: HTMLDivElement
  let player: PlayerType | null = null

  onMount(async () => {
    const { Player, MediaControl, SourceController } = await import('@gcorevideo/player')
    await import('@gcorevideo/player/dist/index.css')

    Player.registerPlugin(MediaControl)
    Player.registerPlugin(SourceController)

    player = new Player({ autoPlay: true, mute: true, sources: [src] })
    player.attachTo(container)
  })

  onDestroy(() => {
    player?.destroy()
  })
</script>

<div bind:this={container} style="width: 100%; aspect-ratio: 16/9;" />
```

---

## Common pitfalls across all frameworks

| Problem | Cause | Fix |
|---|---|---|
| Player renders but no video | CSS not imported | `import '@gcorevideo/player/dist/index.css'` |
| Blank container | Element has no dimensions | Set `width` and `height` or `aspect-ratio` on the container |
| "Player already initialized" error | `attachTo` called twice | Guard with a ref check or destroy before re-attaching |
| Memory leak in SPA navigation | `destroy()` not called | Always call `player.destroy()` in cleanup / unmount handler |
| Autoplay blocked by browser | `autoPlay: true` without `mute` | Always pair `autoPlay: true` with `mute: true` |
| SSR crash in Next.js / Nuxt | Player imported at module level | Use dynamic import or `.client.vue` suffix |
| Plugin not working | Registered after `new Player()` | `Player.registerPlugin()` must precede the constructor call |
