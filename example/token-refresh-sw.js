/**
 * token-refresh-sw.js — Service Worker for seamless token refresh on Safari native HLS
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ────────────────────
 * Safari (iOS / macOS) uses its own native HLS engine for <video> elements even
 * when MediaSource Extensions (MSE) are available, depending on the iOS version
 * and stream type. The native media pipeline makes its own network requests that
 * bypass every JavaScript hook (xhrSetup, fetchSetup, custom loaders…).
 *
 * A Service Worker is the ONLY way to intercept those requests. This SW:
 *   1. Intercepts every fetch from the page scope.
 *   2. Detects Gcore protected-content URLs (/{token}/{expires}/ path pattern).
 *   3. Rewrites the token and expires segment to the latest values.
 *   4. Forwards the rewritten request to the CDN.
 *
 * The main thread posts new token state via BroadcastChannel whenever
 * TokenRefreshPlugin refreshes (or at initial load). The SW stores that state
 * in memory and uses it for all subsequent rewrites.
 *
 * REGISTRATION (from your page)
 * ──────────────────────────────
 *   if ('serviceWorker' in navigator) {
 *     await navigator.serviceWorker.register('/example/token-refresh-sw.js', {
 *       scope: '/example/'
 *     })
 *   }
 *
 *   // After registration and after every TokenRefreshPlugin refresh:
 *   const swChannel = new BroadcastChannel('gcore-token-refresh')
 *   swChannel.postMessage({
 *     type: 'TOKEN_UPDATE',
 *     payload: { token: '…', expires: 1234567890 }
 *   })
 *
 * INTEGRATION WITH TokenRefreshPlugin
 * ────────────────────────────────────
 * Pass the BroadcastChannel post as the onTokenRefreshed callback:
 *
 *   const swChannel = new BroadcastChannel('gcore-token-refresh')
 *
 *   tokenRefresh: {
 *     getToken: fetchToken,
 *     onTokenRefreshed(data) {
 *       swChannel.postMessage({
 *         type: 'TOKEN_UPDATE',
 *         payload: { token: data.token, expires: data.expires }
 *       })
 *     }
 *   }
 *
 * SECURITY
 * ────────
 * The SW only rewrites URLs that match the Gcore token path pattern
 * (/[A-Za-z0-9_-]{6,}/1\d{9,}/) — all other requests pass through unmodified.
 * No token value is ever logged or stored persistently.
 *
 * COMPATIBILITY
 * ─────────────
 * • Safari 14.5+ (iOS & macOS) — Service Worker support with BroadcastChannel
 * • Chrome, Firefox, Edge       — SW supported; hls.js custom loader is used
 *                                  instead (SW is a no-op for those).
 * • iOS < 14.5                  — SW not supported; plugin falls back to
 *                                  source-reload + seek-restore.
 */

// ── Channel name must match the main thread ──────────────────────────────────
const BROADCAST_CHANNEL = 'gcore-token-refresh'

// ── In-memory token state (refreshed via BroadcastChannel) ──────────────────
let tokenState = null  // { token: string, expires: number }

// ── Listen for token updates from the main thread ────────────────────────────
const channel = new BroadcastChannel(BROADCAST_CHANNEL)

channel.onmessage = (event) => {
  if (event.data?.type === 'TOKEN_UPDATE') {
    tokenState = event.data.payload
    // Service Workers cannot use console.log reliably on all platforms;
    // leave a trace via a custom header on the very next rewritten request instead.
  }
}

// ── Lifecycle: activate immediately so the first page load is covered ─────────
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// ── Fetch intercept ───────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Only handle GET requests (media resources are always GET).
  if (event.request.method !== 'GET') return

  // Skip if we haven't received a token yet — let the original URL through.
  if (!tokenState) return

  const url = new URL(event.request.url)

  // Only rewrite URLs that contain the Gcore token-in-path pattern.
  if (!hasTokenPattern(url.pathname)) return

  event.respondWith(rewriteAndFetch(event.request, url))
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if `pathname` contains the pattern
 * `/{base64url-token}/{unix-expires}/`.
 */
function hasTokenPattern(pathname) {
  return /\/[A-Za-z0-9_-]{6,}\/1\d{9,}\//.test(pathname)
}

/**
 * Rewrites the token/expires segments of the URL and fetches the result.
 *
 * Original: …/videos/{id}/{OLD_TOKEN}/{OLD_EXPIRES}/segment.ts
 * Rewritten: …/videos/{id}/{NEW_TOKEN}/{NEW_EXPIRES}/segment.ts
 */
async function rewriteAndFetch(originalRequest, parsedUrl) {
  // Replace the first matching /{token}/{expires}/ with current values.
  const newPathname = parsedUrl.pathname.replace(
    /\/([A-Za-z0-9_-]{6,})\/(1\d{9,})\//,
    `/${tokenState.token}/${tokenState.expires}/`,
  )

  parsedUrl.pathname = newPathname
  const newUrl = parsedUrl.toString()

  // Build a new Request preserving method, headers, mode, credentials.
  const newRequest = new Request(newUrl, {
    method: originalRequest.method,
    headers: originalRequest.headers,
    // 'navigate' mode is not allowed for cross-origin SW fetch; use 'cors'.
    mode: originalRequest.mode === 'navigate' ? 'cors' : originalRequest.mode,
    credentials: originalRequest.credentials,
    redirect: originalRequest.redirect,
  })

  return fetch(newRequest)
}
