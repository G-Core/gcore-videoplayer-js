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

## Protected-content streams — automatic token refresh

Gcore protected-content streams embed a security token and expiry timestamp
directly in the URL path:

```
https://host/videos/{video-id}/{token}/{expires}/master.m3u8
```

Once a token expires the CDN returns HTTP 401 for every segment request.
`TokenRefreshPlugin` handles renewal transparently: it fires a background timer
before the token expires, calls your `getToken()` function, and rewrites the
`/{token}/{expires}/` segment in every outgoing hls.js or dash.js request URL —
playback continues without buffering or interruption.

### Supported playback engines

| Engine | Mechanism | Interruption |
|---|---|---|
| **hls.js** | Custom loader rewrites every request URL before XHR `open()` | None |
| **dash.js** | `addRequestInterceptor` rewrites every request URL | None |
| **Native `<video>`** (older Safari) | Source reload + seek restore | Brief |

For fully seamless refresh on older Safari, register `example/token-refresh-sw.js`
as a Service Worker — it intercepts all CDN fetch requests and rewrites the token
even for native media elements.

### Usage

```ts
import { Player, TokenRefreshPlugin } from '@gcorevideo/player'

// Register once before creating any player instance.
Player.registerPlugin(TokenRefreshPlugin)

const player = new Player({
  sources: [{
    // The token API returns a ready-to-use URL with the token embedded in the path.
    // TokenRefreshPlugin reads the initial {token}/{expires} from this URL at startup.
    source: 'https://host/videos/{id}/{token}/{expires}/master.m3u8',
    mimeType: 'application/x-mpegURL',
  }],

  tokenRefresh: {
    /**
     * Called automatically ~refreshLeadSeconds before the current token expires.
     * Must return a Promise resolving to a TokenResponse object.
     */
    getToken: () => fetch('https://your-token-api/token').then(r => r.json()),

    /**
     * Set to true to use IP-bound tokens (token_ip / url_ip).
     * All CDN requests must then originate from the same IP as the first response.
     * Default: false.
     */
    ipBound: false,

    /**
     * How many seconds before expiry to pre-fetch the new token.
     * Rule of thumb: refreshLeadSeconds < tokenLifetime / 2.
     * Default: 5.
     */
    refreshLeadSeconds: 5,

    /** Optional callback fired after each successful token refresh. */
    onTokenRefreshed(data) {
      console.log('token refreshed, new expiry:', new Date(data.expires * 1000))
    },
  },
})

player.attachTo(document.getElementById('player'))
```

### TokenResponse shape

Your `getToken()` function must return an object with this structure:

```ts
interface TokenResponse {
  token:     string  // plain (any-IP) token
  token_ip:  string  // IP-bound token
  client_ip: string  // client IP the token server observed
  expires:   number  // Unix timestamp (seconds) when both tokens expire
  url:       string  // full HLS master URL with plain token in path
  url_ip:    string  // full HLS master URL with IP-bound token in path
}
```

### Pausing and resuming refresh

Use the plugin instance to suspend and resume the refresh cycle at runtime:

```ts
const plugin = player.getPlugin('token_refresh')

plugin.pause()          // stop the timer; existing token stays active until CDN rejects it
plugin.resume()         // restart the timer; fetches immediately if token already expired
console.log(plugin.isPaused)  // → true | false
```

### Working demo

See [`example/protected-content.html`](../../example/protected-content.html) and
[`example/protected-content.js`](../../example/protected-content.js) for a fully
annotated end-to-end integration, including UI feedback, IP-bound token switching,
a live countdown, and Service Worker integration notes.

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
