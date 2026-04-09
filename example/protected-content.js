// =============================================================================
// protected-content.js — Token Refresh Demo: reusable helper module
// =============================================================================
//
// PURPOSE
// -------
// This module provides `initProtectedPlayer()`, a self-contained function that
// wires up the Gcore video player with automatic token refresh for a
// protected HLS stream. It is imported by protected-content.html (and could
// be used by any other demo page that needs the same setup).
//
// RELATIONSHIP TO TokenRefreshPlugin
// ------------------------------------
// This file does NOT contain the actual refresh logic. The plugin lives at:
//   packages/player/src/plugins/token-refresh/TokenRefreshPlugin.ts
//
// This module's role is purely demo orchestration:
//   1. Fetch the initial token from the token API.
//   2. Register plugins on the Player class (once, idempotently).
//   3. Construct and configure the Player with `tokenRefresh` options.
//   4. Update UI elements on each token refresh callback.
//
// TOKEN API (demo)
// ----------------
// https://video-token-102748.fastedge.app/
//   ?video=iKbrdNMcS9ylGuw  — video asset identifier
//   &type=vod               — vod | live
//   &expire=60              — token lifetime in seconds
//
// Response shape (TokenResponse):
//   token      — base64url secure token (valid from any IP)
//   token_ip   — base64url secure token (locked to client_ip)
//   client_ip  — IP address observed by the token API for this request
//   expires    — Unix timestamp (seconds) when both tokens expire
//   url        — ready-to-use HLS master URL with plain token in path
//   url_ip     — ready-to-use HLS master URL with IP-bound token in path
//
// URL PATH FORMAT
// ---------------
// Gcore protected-content embeds auth data directly in the URL path — not in
// headers or query parameters. Format:
//   https://{cdn-host}/videos/{video-id}/{token}/{expires}/master.m3u8
// All segment, playlist, and key URLs derived from this manifest contain the
// same {token}/{expires} path segments.
//
// WHY PATH-EMBEDDED TOKENS (not headers or query params)?
// -------------------------------------------------------
// • HLS/DASH clients (hls.js, Safari native, dash.js) derive every segment URL
//   from the master playlist. Injecting auth via custom headers requires either
//   a custom loader (hls.js) or a Service Worker — and even then, headers are
//   stripped by many CDN edge nodes for media requests.
// • Query-parameter tokens are visible in access logs and referer headers.
// • Path-embedded tokens are the Gcore CDN convention; the regex
//   /\/([A-Za-z0-9_-]{6,})\/(1\d{9,})\// matches them reliably.
//
// SAFARI COMPATIBILITY
// --------------------
// Modern Safari (macOS 14 / iOS 14.5+) supports MSE, so hls.js runs and the
// custom-loader path is used — fully seamless, no source reload.
// Older Safari falls back to native <video> HLS; TokenRefreshPlugin then
// reloads the source URL before the token expires and seeks back.
// For seamless old-Safari support, register token-refresh-sw.js as a
// Service Worker (see that file for instructions) and pass its token updates
// via BroadcastChannel in the onTokenRefreshed callback.
// =============================================================================

// Token API endpoint. expire=10 keeps refreshes frequent for demo visibility.
// In production use a longer lifetime (e.g. 300–3600 s) to reduce API load.
const TOKEN_API =
  'https://video-token-102748.fastedge.app/?video=iKbrdNMcS9ylGuw&type=vod&expire=10'

// ── Token fetcher ────────────────────────────────────────────────────────────

/**
 * Fetches a fresh token from the Gcore token API.
 *
 * This function is passed directly to `tokenRefresh.getToken` in the Player
 * config. The plugin calls it automatically ~refreshLeadSeconds before expiry.
 * It is also called manually for the initial token before the Player is created.
 *
 * Throws on non-OK HTTP responses so the caller (plugin or initProtectedPlayer)
 * can handle the error and update UI accordingly.
 */
async function fetchToken() {
  const res = await fetch(TOKEN_API)
  if (!res.ok) throw new Error(`Token API ${res.status}`)
  return res.json()
}

// ── Demo UI helpers ──────────────────────────────────────────────────────────

/**
 * Prepend a timestamped line to the event log textarea.
 *
 * WHY prepend instead of append?
 * New events are written at the top so the latest entry is always visible
 * without the user needing to scroll. logEl.value is a plain string —
 * prepending is O(n) in string length but sufficient for a demo log.
 *
 * @param {HTMLTextAreaElement} el - The log textarea element.
 * @param {string} msg - The message to log.
 */
function log(el, msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
  el.value = `[${ts}] ${msg}\n` + el.value
}

/**
 * Update the token-status badge text and colour.
 *
 * Uses CSS custom properties (--ok, --accent) so the badge respects any
 * theming applied to the page.
 *
 * @param {HTMLElement} el - The badge element.
 * @param {string} text - Status string to display.
 * @param {boolean} [ok=true] - True for healthy (green), false for error (red).
 */
function setStatus(el, text, ok = true) {
  el.textContent = text
  el.style.color = ok ? 'var(--ok, #1f6d4f)' : 'var(--accent, #b84b32)'
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Initialise the protected-content demo player.
 *
 * FLOW
 * ----
 * 1. Fetch initial token  → needed to get the source URL before Player is created.
 * 2. Register plugins     → idempotent guard prevents duplicate registration on
 *                           hot-reload or if this function is called more than once.
 * 3. Set up countdown UI  → independent setInterval that drives the UI display;
 *                           the plugin's own timer drives the actual refresh logic.
 * 4. Create Player        → pass source URL from token API + tokenRefresh config.
 * 5. Attach to DOM        → player.attachTo(mountEl) mounts the player shell.
 *
 * IMPORTANT: The source URL passed to Player must contain a valid {token}/{expires}
 * path segment. TokenRefreshPlugin reads it at startup to seed `originalState`.
 * If the URL has no token pattern the plugin silently becomes a no-op.
 *
 * @param {object} deps - Named player exports from the SDK build or CDN bundle.
 *   Must include: { Player, MediaControl, QualityLevels, Spinner, ErrorScreen, TokenRefreshPlugin }
 * @param {HTMLElement} mountEl    - DOM node the player renders into.
 * @param {HTMLTextAreaElement} logEl    - Textarea for event log output.
 * @param {HTMLElement} statusEl   - Element showing current token status text.
 * @param {HTMLElement} tokenEl    - Element displaying the current token value.
 * @param {HTMLElement} expiresEl  - Element displaying expiry info (countdown).
 * @returns {Promise<import('@gcorevideo/player').Player|undefined>}
 */
export async function initProtectedPlayer(
  { Player, MediaControl, QualityLevels, Spinner, ErrorScreen, TokenRefreshPlugin },
  mountEl,
  logEl,
  statusEl,
  tokenEl,
  expiresEl,
) {
  // ── 1. Fetch initial token ─────────────────────────────────────────────────
  //
  // The token API must be called BEFORE constructing the Player because the
  // Player source URL must already contain a valid token. We cannot construct
  // the Player with a placeholder URL and swap it in later — TokenRefreshPlugin
  // reads the source URL once on CORE_CONTAINERS_CREATED to extract originalState.
  log(logEl, 'Fetching initial token…')
  setStatus(statusEl, 'Fetching token…', true)

  let tokenData
  try {
    tokenData = await fetchToken()
  } catch (err) {
    setStatus(statusEl, `Token fetch failed: ${err.message}`, false)
    log(logEl, `ERROR: ${err.message}`)
    return
  }

  log(logEl, `Token received — expires ${new Date(tokenData.expires * 1000).toISOString()}`)
  log(logEl, `IP: ${tokenData.client_ip}`)
  log(logEl, `URL: ${tokenData.url}`)

  // ── 2. Register plugins ────────────────────────────────────────────────────
  //
  // Player.registerPlugin() is a class-level (static) operation — plugins are
  // registered globally and apply to every Player instance on the page.
  //
  // Guard against duplicate registration (e.g. hot-reload dev environments or
  // calling initProtectedPlayer() multiple times). Clappr throws an AssertionError
  // if the same plugin name is registered twice.
  //
  // Registration order matters:
  //   TokenRefreshPlugin is a CorePlugin — register it first so it is always
  //   available to intercept CORE_CONTAINERS_CREATED before playback starts.
  //   BottomGear must be registered before QualityLevels (QualityLevels asserts
  //   bottom_gear is present during initialization).
  if (!Player.corePlugins.some((p) => p.prototype?.name === 'token_refresh')) {
    Player.registerPlugin(TokenRefreshPlugin)
  }
  if (!Player.corePlugins.some((p) => p.prototype?.name === 'media_control')) {
    Player.registerPlugin(MediaControl)
    Player.registerPlugin(QualityLevels)
    Player.registerPlugin(Spinner)
    Player.registerPlugin(ErrorScreen)
  }

  // ── 3. Countdown display ───────────────────────────────────────────────────
  //
  // The countdown is a UI concern only. It runs on its own setInterval and is
  // completely independent of the plugin's internal refresh timer.
  // `currentExpires` is updated whenever displayToken() is called (initial load
  // + every onTokenRefreshed callback), so the countdown always reflects the
  // latest token's expiry.
  //
  // WHY a separate timer instead of reacting to plugin events?
  // The plugin does not emit per-second "time remaining" events — only
  // onTokenRefreshed after a successful fetch. A local setInterval is simpler
  // and sufficient for demo display purposes.
  let currentExpires = tokenData.expires
  let countdownTimer = null

  function updateCountdown() {
    const secsLeft = currentExpires - Math.floor(Date.now() / 1000)
    if (expiresEl) {
      expiresEl.textContent =
        secsLeft > 0 ? `${secsLeft}s` : 'refreshing…'
      // Turn red when 10 s or fewer remain to signal imminent refresh.
      expiresEl.style.color =
        secsLeft <= 10 ? 'var(--accent, #b84b32)' : 'inherit'
    }
  }

  function startCountdown(expires) {
    currentExpires = expires
    if (countdownTimer) clearInterval(countdownTimer)
    countdownTimer = setInterval(updateCountdown, 1000)
    updateCountdown() // immediate first tick, no 1 s delay
  }

  // Update UI fields and restart the countdown with the new token data.
  // Called once at init and again on every onTokenRefreshed callback.
  function displayToken(data) {
    if (tokenEl) tokenEl.textContent = data.token.slice(0, 12) + '…'
    setStatus(statusEl, 'Active', true)
    startCountdown(data.expires)
  }

  displayToken(tokenData)

  // ── 4. Create player ───────────────────────────────────────────────────────
  //
  // Key config decisions:
  //
  // sources[0].source — use tokenData.url (the plain-token variant).
  //   The URL already has the token and expires embedded:
  //   https://demo-protected.gvideo.io/videos/{id}/{token}/{expires}/master.m3u8
  //   TokenRefreshPlugin reads this exact string to seed originalState.
  //   See `extractTokenState()` in TokenRefreshPlugin.ts for the regex.
  //
  // tokenRefresh.getToken — same fetchToken() used above.
  //   The plugin calls this ~refreshLeadSeconds before expiry. It does not
  //   need any state from the previous call; each call returns a fully
  //   self-contained TokenResponse with new token, expires, url, url_ip.
  //
  // tokenRefresh.ipBound — false means use the plain (any-IP) token.
  //   Set to true to use token_ip / url_ip instead; all subsequent CDN
  //   requests must originate from the same IP as tokenData.client_ip.
  //
  // tokenRefresh.refreshLeadSeconds — fetch new token 5 s before expiry.
  //   Must satisfy: refreshLeadSeconds < tokenLifetime.
  //   Smaller values risk 401s if the fetch is slow; larger values waste
  //   token budget. 5 s is a safe default for typical token lifetimes >= 30 s.
  const player = new Player({
    sources: [
      {
        source: tokenData.url,
        mimeType: 'application/x-mpegURL',
      },
    ],
    playbackType: 'vod',

    tokenRefresh: {
      /**
       * Called ~refreshLeadSeconds before the current token expires.
       * Must return a Promise<TokenResponse>.
       */
      getToken: fetchToken,

      /**
       * false → use plain token (any IP).
       * true  → use IP-bound token (tied to client_ip from first response).
       */
      ipBound: false,

      /** Seconds before expiry to pre-fetch the replacement token. */
      refreshLeadSeconds: 5,

      /**
       * Called immediately after the plugin applies the new token to currentState.
       * At this point the custom hls.js loader (or dash.js interceptor) is already
       * using the new token for all outgoing requests. The UI update here is
       * purely cosmetic — playback is uninterrupted.
       */
      onTokenRefreshed(data) {
        log(logEl, `Token refreshed — new expiry ${new Date(data.expires * 1000).toISOString()}`)
        displayToken(data)
      },
    },
  })

  // ── 5. Player event logging ────────────────────────────────────────────────
  player.on('ready',  () => log(logEl, 'Player ready'))
  player.on('play',   () => log(logEl, 'Playback started'))
  player.on('pause',  () => log(logEl, 'Paused'))
  player.on('ended',  () => log(logEl, 'Ended'))
  player.on('error',  (err) => {
    log(logEl, `ERROR: ${err?.message ?? JSON.stringify(err)}`)
    setStatus(statusEl, 'Playback error', false)
  })

  // Mount the player into the DOM. Must be the last step — attachTo() triggers
  // Clappr's container/playback setup, which fires CORE_CONTAINERS_CREATED and
  // causes TokenRefreshPlugin to run onContainersCreated() and inject the loader.
  player.attachTo(mountEl)
  return player
}

// ── IP-bound variant ──────────────────────────────────────────────────────────

/**
 * Convenience wrapper that initialises the player with the IP-bound token variant.
 *
 * IP-bound tokens (token_ip / url_ip) tie the token to the client IP address
 * that was present in the FIRST token response (tokenData.client_ip). Any
 * subsequent CDN request from a different IP is rejected with HTTP 401.
 *
 * USE CASE: Higher-security scenarios where you want to prevent token sharing
 * across different clients. Note that users behind NAT, VPNs, or mobile
 * networks may have their IP change mid-session, which would break playback.
 *
 * CURRENT IMPLEMENTATION NOTE
 * This wrapper currently calls initProtectedPlayer() with `ipBound: false`
 * (the default) because the ipBound flag in the Player config controls which
 * token variant the plugin extracts from each TokenResponse — but the source
 * URL passed to the Player still comes from tokenData.url (plain token).
 *
 * To properly use the IP-bound variant, you would either:
 *   a) Pass tokenData.url_ip as the source URL and set ipBound: true in config.
 *   b) Let the plugin's `ipBound: true` option select url_ip automatically on
 *      first refresh (the initial source URL can use either variant).
 *
 * This helper exists as a hook for future extension and to show the intended API.
 *
 * @param deps    - Same as initProtectedPlayer.
 * @param mountEl - Same as initProtectedPlayer.
 * @param logEl   - Same as initProtectedPlayer.
 * @param statusEl - Same as initProtectedPlayer.
 * @param tokenEl - Same as initProtectedPlayer.
 * @param expiresEl - Same as initProtectedPlayer.
 */
export async function initProtectedPlayerIpBound(deps, mountEl, logEl, statusEl, tokenEl, expiresEl) {
  // In a production integration, override the source URL selection here to
  // use tokenData.url_ip before calling initProtectedPlayer, then set
  // ipBound: true in the tokenRefresh config so the plugin also selects
  // token_ip from every subsequent TokenResponse.
  return initProtectedPlayer(
    deps,
    mountEl,
    logEl,
    statusEl,
    tokenEl,
    expiresEl,
  )
}
