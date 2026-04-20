import { $, Container, Core, CorePlugin, Events } from '@clappr/core'
import HLSJS from 'hls.js'
import { trace } from '@gcorevideo/utils'

import { CLAPPR_VERSION } from '../../build.js'

const T = 'plugins.token_refresh'

/**
 * Response shape expected from your token-refresh API endpoint.
 * @public
 */
export interface TokenResponse {
  /** Plain (non-IP-bound) secure token */
  token: string
  /** IP-bound secure token */
  token_ip: string
  /** Client IP address (informational) */
  client_ip: string
  /** Unix timestamp (seconds) when both tokens expire */
  expires: number
  /** Ready-to-use HLS master playlist URL with plain token embedded */
  url: string
  /** Ready-to-use HLS master playlist URL with IP-bound token embedded */
  url_ip: string
}

/**
 * Configuration options for {@link TokenRefreshPlugin}.
 * @public
 */
export interface TokenRefreshOptions {
  /**
   * Async function called each time a fresh token is needed.
   * Must return a {@link TokenResponse}.
   */
  getToken: () => Promise<TokenResponse>
  /**
   * When `true`, the IP-bound variant (`token_ip` / `url_ip`) is used.
   * Defaults to `false`.
   */
  ipBound?: boolean
  /**
   * Seconds before the token expiry timestamp to request a fresh token.
   * Defaults to `5`.
   */
  refreshLeadSeconds?: number
  /**
   * Optional callback invoked after every successful token refresh.
   */
  onTokenRefreshed?: (data: TokenResponse) => void
}

type TokenState = { token: string; expires: number }

/**
 * Parses `/{token}/{expires}/` from a Gcore protected-content URL.
 * Token is base64url (letters, digits, `-`, `_`).
 * Expires is a ≥10-digit Unix timestamp.
 */
function extractTokenState(url: string): TokenState | null {
  const m = url.match(/\/([A-Za-z0-9_-]{6,})\/(1\d{9,})\//)
  if (!m) return null
  return { token: m[1], expires: parseInt(m[2], 10) }
}

/** Replaces the exact `/{oldToken}/{oldExpires}/` segment in a URL. */
function rewriteUrl(url: string, from: TokenState, to: TokenState): string {
  const oldPart = `/${from.token}/${from.expires}/`
  const newPart = `/${to.token}/${to.expires}/`
  return url.includes(oldPart) ? url.replace(oldPart, newPart) : url
}

/**
 * Returns a custom hls.js loader class that transparently rewrites the
 * token/expires path segments in every request URL.
 *
 * The returned class extends the default hls.js XhrLoader so all native
 * hls.js behaviour (retry, timeout, range requests …) is preserved.
 */
function createTokenRewritingLoader(
  getOriginal: () => TokenState | null,
  getCurrent: () => TokenState | null,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DefaultLoader = HLSJS.DefaultConfig.loader as any

  return class TokenRewritingLoader extends DefaultLoader {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    load(context: any, config: any, callbacks: any) {
      const original = getOriginal()
      const current = getCurrent()
      if (original && current && context.url) {
        context.url = rewriteUrl(context.url, original, current)
      }
      super.load(context, config, callbacks)
    }
  }
}

/**
 * `PLUGIN` — automatic token refresh for Gcore protected-content streams.
 *
 * Supports all three playback engines:
 *
 * | Engine | Mechanism | Interruption |
 * |--------|-----------|--------------|
 * | **hls.js** | Custom loader rewrites every request URL | None |
 * | **dash.js** | `addRequestInterceptor` rewrites every request URL | None |
 * | **Native `<video>`** (Safari ≤ iOS 14.4) | Source reload + seek restore | Brief |
 *
 * @public
 * @remarks
 * Register the plugin once before creating any player instance:
 * ```ts
 * import { Player, TokenRefreshPlugin } from '@gcorevideo/player'
 * Player.registerPlugin(TokenRefreshPlugin)
 * ```
 *
 * Then pass `tokenRefresh` in `PlayerConfig`:
 * ```ts
 * const player = new Player({
 *   sources: [{ source: initialUrl, mimeType: 'application/x-mpegURL' }],
 *   tokenRefresh: {
 *     getToken: () => fetch('https://…/token').then(r => r.json()),
 *     ipBound: false,
 *     refreshLeadSeconds: 5,
 *     onTokenRefreshed: (data) => console.log('new token expires', data.expires),
 *   },
 * })
 * ```
 *
 * @example
 * Safari native — opt-in Service Worker for fully seamless refresh:
 * ```js
 * // Register token-refresh-sw.js (see example/ directory)
 * // and omit tokenRefresh config — the SW handles rewriting.
 * ```
 */
export class TokenRefreshPlugin extends CorePlugin {
  /** @internal */
  static get type(): 'core' {
    return 'core'
  }

  /** @internal */
  get name(): string {
    return 'token_refresh'
  }

  /** @internal */
  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  /** Token state extracted from the initial source URL */
  private originalState: TokenState | null = null
  /** Latest token state (updated after each refresh) */
  private currentState: TokenState | null = null
  /** Prevents double-initialisation when containers are recreated on reload */
  private initialized = false
  /** Scheduled refresh timer handle */
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  /** Playback time (seconds) to restore after a native-video source reload */
  private savedPosition: number | null = null
  /** True when using native HTML5 Video playback (no request interception) */
  private isNativePlayback = false
  /** When true, the refresh cycle is suspended until resume() is called */
  private paused = false

  /** @internal */
  override bindEvents(): void {
    this.listenTo(
      this.core,
      Events.CORE_CONTAINERS_CREATED,
      this.onContainersCreated,
    )
  }

  /** @internal */
  override destroy(): void {
    this.clearTimer()
    super.destroy()
  }

  private onContainersCreated(): void {
    const container: Container = this.core.containers[0]
    if (!container) return

    const playbackName: string = container.playback.name
    const src: string = container.playback.options?.src ?? ''

    trace(`${T} onContainersCreated`, { playbackName, src: src.slice(0, 80) })

    // First time only: extract token state and schedule the refresh cycle.
    if (!this.initialized) {
      const state = extractTokenState(src)
      if (!state) {
        trace(`${T} no token pattern in source URL — plugin is inactive`)
        return
      }
      this.originalState = { ...state }
      this.currentState = { ...state }
      this.initialized = true
      this.scheduleRefresh()
    }

    // Inject the appropriate interception mechanism for this playback engine.
    switch (playbackName) {
      case 'hls':
        this.injectHlsLoader(container)
        break
      case 'dash':
        this.injectDashInterceptor(container)
        break
      default:
        // Native HTML5 Video — no request hooks available.
        this.isNativePlayback = true
        // Seek restore after a token-triggered reload.
        this.listenToOnce(
          this.core,
          Events.CORE_ACTIVE_CONTAINER_CHANGED,
          this.onActiveContainerChangedForNative,
        )
        break
    }
  }

  private injectHlsLoader(container: Container): void {
    const getOriginal = () => this.originalState
    const getCurrent = () => this.currentState
    const TokenLoader = createTokenRewritingLoader(getOriginal, getCurrent)

    $.extend(true, container.playback.options, {
      playback: {
        hlsjsConfig: {
          loader: TokenLoader,
        },
      },
    })

    trace(`${T} HLS custom loader injected`)
  }

  private injectDashInterceptor(container: Container): void {
    $.extend(true, container.playback.options, {
      dash: {
        requestInterceptor: (request: { url: string }) => {
          if (this.originalState && this.currentState) {
            request.url = rewriteUrl(
              request.url,
              this.originalState,
              this.currentState,
            )
          }
          return Promise.resolve(request)
        },
      },
    })

    trace(`${T} DASH request interceptor injected`)
  }

  private async reloadNativeSource(data: TokenResponse): Promise<void> {
    const container = this.core.activeContainer
    const playback = container?.playback
    if (!playback) return

    // Capture current playback position before tearing down the container.
    const mediaEl = playback.el as HTMLMediaElement
    const currentTime = mediaEl?.currentTime ?? 0
    this.savedPosition = currentTime > 0 ? currentTime : null

    const newUrl = this.opts.ipBound ? data.url_ip : data.url
    trace(`${T} native reload`, { newUrl: newUrl.slice(0, 80), savedPosition: this.savedPosition })

    // core.load() destroys and recreates all containers.
    this.core.load(
      [{ source: newUrl, mimeType: this.core.options.mimeType ?? 'application/x-mpegURL' }],
    )
  }

  private onActiveContainerChangedForNative(): void {
    if (this.savedPosition === null) return

    const pos = this.savedPosition
    this.savedPosition = null

    // Wait for the new container to be fully ready before seeking.
    const container = this.core.activeContainer
    if (!container) return

    this.listenToOnce(container, Events.CONTAINER_READY, () => {
      trace(`${T} native: restoring position`, { pos })
      container.seek(pos)
      container.play()
    })
  }

  /**
   * Suspend automatic token refresh.
   * In-flight requests continue with the current token; no new token is fetched
   * until {@link resume} is called.
   * @public
   */
  pause(): void {
    if (this.paused) return
    this.paused = true
    this.clearTimer()
    trace(`${T} refresh paused`)
  }

  /**
   * Resume automatic token refresh after a {@link pause}.
   * Immediately re-schedules the next refresh based on the current token expiry.
   * If the token has already expired (or is about to), the refresh fires within
   * one second.
   * @public
   */
  resume(): void {
    if (!this.paused) return
    this.paused = false
    trace(`${T} refresh resumed`)
    this.scheduleRefresh()
  }

  /** Returns `true` when the refresh cycle is currently suspended. @public */
  get isPaused(): boolean {
    return this.paused
  }

  private scheduleRefresh(): void {
    this.clearTimer()
    if (!this.currentState || this.paused) return

    const leadMs = (this.opts.refreshLeadSeconds ?? 5) * 1000
    const msUntilRefresh =
      this.currentState.expires * 1000 - Date.now() - leadMs

    trace(`${T} next refresh in`, {
      seconds: Math.round(msUntilRefresh / 1000),
      expires: new Date(this.currentState.expires * 1000).toISOString(),
    })

    this.refreshTimer = setTimeout(
      () => this.performRefresh(),
      Math.max(msUntilRefresh, 1000),
    )
  }

  private async performRefresh(): Promise<void> {
    if (this.paused) return
    trace(`${T} fetching new token`)
    try {
      const data = await this.opts.getToken()
      const newToken = this.opts.ipBound ? data.token_ip : data.token
      const newState: TokenState = { token: newToken, expires: data.expires }

      if (this.isNativePlayback) {
        // Must reload source because the <video> element has no request hook.
        await this.reloadNativeSource(data)
      }

      // originalState is never changed after init — it holds the token that was
      // baked into every URL in the initial manifest. hls.js/dash.js always
      // produces request URLs based on that manifest, so every segment URL
      // still contains the original token regardless of how many refreshes
      // have already happened. The loader replaces original→current on each
      // request, so updating only currentState is sufficient.
      this.currentState = newState

      this.opts.onTokenRefreshed?.(data)
      trace(`${T} token refreshed`, {
        token: newToken.slice(0, 8) + '…',
        expires: new Date(data.expires * 1000).toISOString(),
      })
    } catch (err) {
      trace(`${T} token refresh failed`, { err })
    }

    // Always reschedule, even after an error (will retry near next expiry).
    this.scheduleRefresh()
  }

  private get opts(): TokenRefreshOptions {
    return this.options.tokenRefresh as TokenRefreshOptions
  }

  private clearTimer(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
  }
}
