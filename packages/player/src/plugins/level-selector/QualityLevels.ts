import { Events, template, UICorePlugin } from '@clappr/core'
// import { trace } from '@gcorevideo/utils'
import assert from 'assert'

import { type QualityLevel } from '../../playback.types.js'
import { CLAPPR_VERSION } from '../../build.js'
import { ZeptoResult } from '../../types.js'
import { TemplateFunction } from '../types.js'
import { BottomGear, GearEvents } from '../bottom-gear/BottomGear.js'

import buttonHtml from '../../../assets/level-selector/button.ejs'
import listHtml from '../../../assets/level-selector/list.ejs'
import arrowRightIcon from '../../../assets/icons/new/arrow-right.svg'
import arrowLeftIcon from '../../../assets/icons/new/arrow-left.svg'
import checkIcon from '../../../assets/icons/new/check.svg'
import '../../../assets/level-selector/style.scss'
import { MediaControl } from '../media-control/MediaControl.js'

// const T = 'plugins.quality_levels'
const VERSION = 'v2.22.5'

/**
 * Controls which codec is selected when a multi-codec HLS manifest is loaded.
 * @public
 * @see {@link QualityLevelsPluginSettings}
 */
export type CodecStrategy =
  /**
   * Pick the codec the browser can hardware-decode most efficiently
   * (`MediaCapabilities.decodingInfo → powerEfficient`), falling back to the
   * first playable codec in preference order (AV1 → HEVC → H.264).
   * This is the default and minimises battery drain.
   */
  | 'power-efficient'
  /**
   * Pick the highest-preference codec the browser can play at all
   * (AV1 → HEVC → H.264), ignoring power efficiency.
   * Use this when you want the best compression regardless of whether
   * hardware decode is reported as efficient (e.g. AV1 on Chrome macOS).
   */
  | 'best-supported'

/**
 * Configuration options for the {@link QualityLevels} plugin.
 * @public
 */
export interface QualityLevelsPluginSettings {
  /**
   * The maximum resolution to allow in the level selector.
   */
  restrictResolution?: number
  /**
   * The labels to show in the level selector.
   * @example
   * ```ts
   * { 360: 'SD', 720: 'HD' }
   * ```
   */
  labels?: Record<number, string>
  /**
   * Codec selection strategy for multi-codec HLS streams.
   * Defaults to `'power-efficient'`.
   * @see {@link CodecStrategy}
   */
  codecStrategy?: CodecStrategy
  /**
   * Force a specific codec prefix (e.g. `'av01'`, `'hvc1'`, `'avc1'`) for HLS
   * or DASH streams, bypassing the automatic codec detection. Takes precedence
   * over {@link QualityLevelsPluginSettings.codecStrategy}.
   *
   * Useful for letting the user manually switch codec tiers at runtime by
   * reloading the player with the desired prefix.
   */
  preferredCodecPrefix?: string
}

/**
 * `PLUGIN` that provides a UI to select the desired quality level of the playback.
 * @public
 *
 * @remarks
 * Depends on:
 *
 * - {@link MediaControl}
 *
 * - {@link BottomGear}
 *
 * The plugin is rendered as an item in the gear menu, which, when clicked, shows a list of quality levels to choose from.
 *
 * Configuration options - {@link QualityLevelsPluginSettings}
 *
 * **Multi-codec HLS streams.** When an HLS manifest declares the same resolution at multiple codecs
 * (e.g. `avc1`, `hvc1`, `av01` — common in 4K adaptive streams), the plugin
 * automatically filters the level list to a single codec. This prevents the selector
 * from showing duplicate resolution entries. The codec is chosen according to
 * {@link QualityLevelsPluginSettings.codecStrategy} (default `'power-efficient'`).
 *
 * **Codec selection by platform:**
 *
 * <table>
 * <thead><tr><th>Platform</th><th>AV1 hw</th><th>HEVC hw</th><th>H.264 hw</th><th>Selected</th></tr></thead>
 * <tbody>
 * <tr><td>macOS Safari, Apple Silicon M3+</td><td>✓</td><td>✓</td><td>✓</td><td>AV1</td></tr>
 * <tr><td>macOS Safari, Apple Silicon M1–M2</td><td>✗</td><td>✓</td><td>✓</td><td>HEVC</td></tr>
 * <tr><td>macOS Safari, Intel</td><td>✗</td><td>✗</td><td>✓</td><td>H.264</td></tr>
 * <tr><td>macOS Chrome, Edge</td><td>✗ (not powerEfficient via MSE)</td><td>✓ (Chrome 107+ via VideoToolbox)</td><td>✓</td><td>HEVC — or AV1 with codecStrategy:'best-supported'</td></tr>
 * <tr><td>Windows Chrome, Edge</td><td>✓ (GPU-dependent)</td><td>✓ (Chrome 107+)</td><td>✓</td><td>AV1 or HEVC</td></tr>
 * <tr><td>Windows Firefox</td><td>✓</td><td>✗</td><td>✓</td><td>AV1 or H.264</td></tr>
 * <tr><td>iOS Safari, iPhone 15 Pro+ (A17 Pro+)</td><td>✓</td><td>✓</td><td>✓</td><td>AV1</td></tr>
 * <tr><td>iOS Safari, iPhone 7–15 (A10–A16)</td><td>✗</td><td>✓</td><td>✓</td><td>HEVC</td></tr>
 * <tr><td>Android Chrome, flagship (SD 8 Gen 2+ / Tensor G2+)</td><td>✓</td><td>✗ (blocked)</td><td>✓</td><td>AV1</td></tr>
 * <tr><td>Android Chrome, mid-range / older</td><td>✗</td><td>✗</td><td>✓</td><td>H.264</td></tr>
 * <tr><td>Android Firefox</td><td>✓ (if hw)</td><td>✗</td><td>✓</td><td>AV1 or H.264</td></tr>
 * <tr><td>Samsung Internet, Galaxy S22+</td><td>✗</td><td>✓</td><td>✓</td><td>HEVC</td></tr>
 * </tbody>
 * </table>
 *
 * @example
 * ```ts
 * new Player({
 *   qualityLevels: {
 *     restrictResolution: 360,
 *     labels: { 360: 'SD', 720: 'HD' },
 *   },
 * })
 * ```
 */
export class QualityLevels extends UICorePlugin {
  private levels: QualityLevel[] = []

  private levelLabels: string[] = []

  private removeAuto = false

  private currentText = ''

  private currentTier = ''

  private selectedLevelId = -1

  private static readonly buttonTemplate: TemplateFunction =
    template(buttonHtml)

  private static readonly listTemplate: TemplateFunction = template(listHtml)

  /**
   * @internal
   */
  get name() {
    return 'level_selector'
  }

  /**
   * @internal
   */
  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  /**
   * @internal
   */
  static get version() {
    return VERSION
  }

  /**
   * @internal
   */
  override get attributes() {
    return {
      class: 'level-selector',
      'data-level-selector': '',
    }
  }

  override get events() {
    return {
      'click .gear-sub-menu_btn': 'onSelect',
      'click .go-back': 'goBack',
    }
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenToOnce(this.core, Events.CORE_READY, this.onCoreReady)
    this.listenTo(
      this.core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this.onActiveContainerChange,
    )
  }

  private onCoreReady() {
    const gear = this.core.getPlugin('bottom_gear') as BottomGear
    assert(gear, 'bottom_gear plugin is required')

    this.currentText = this.core.i18n.t('auto')
    this.listenTo(gear, GearEvents.RENDERED, this.onGearRendered)
  }

  private onGearRendered() {
    this.render()
  }

  private onActiveContainerChange() {
    this.removeAuto = false
    this.currentTier = ''

    const activePlayback = this.core.activePlayback

    this.listenTo(
      activePlayback,
      Events.PLAYBACK_LEVELS_AVAILABLE,
      this.onLevelsAvailable,
    )
    this.listenTo(
      activePlayback,
      Events.PLAYBACK_LEVEL_SWITCH_START,
      this.onLevelSwitchStart,
    )
    this.listenTo(
      activePlayback,
      Events.PLAYBACK_LEVEL_SWITCH_END,
      this.onLevelSwitchEnd,
    )
    this.listenTo(activePlayback, Events.PLAYBACK_BITRATE, this.onBitrate)
    this.listenTo(activePlayback, Events.PLAYBACK_STOP, this.onStop)
    if (activePlayback.levels?.length > 0) {
      this.onLevelsAvailable(activePlayback.levels)
    }
  }

  private onStop() {
    this.listenToOnce(this.core.activePlayback, Events.PLAYBACK_PLAY, () => {
      if (this.core.activePlayback.getPlaybackType() === 'live') {
        if (this.selectedLevelId !== -1) {
          this.core.activePlayback.currentLevel = this.selectedLevelId
        }
      }
    })
  }

  private shouldRender() {
    const activePlayback = this.core.activePlayback
    if (!activePlayback) {
      return false
    }

    const supportsCurrentLevel = 'currentLevel' in activePlayback
    if (!supportsCurrentLevel) {
      return false
    }
    // Only care if we have at least 2 to choose from
    return !!(this.levels && this.levels.length > 1)
  }

  /**
   * @internal
   */
  override render() {
    if (!this.shouldRender()) {
      this.$el.hide()
      return this
    }
    this.renderDropdown()
    this.updateButton()

    return this
  }

  private renderDropdown() {
    this.$el.html(
      QualityLevels.listTemplate({
        arrowLeftIcon,
        checkIcon,
        current: this.selectedLevelId,
        labels: this.levelLabels,
        levels: this.levels,
        maxLevel: this.maxLevel,
        removeAuto: this.removeAuto,
        i18n: this.core.i18n,
      }),
    )
  }

  private updateButton() {
    if (!this.shouldRender()) {
      return
    }
    ;(this.core.getPlugin('bottom_gear') as BottomGear)
      ?.addItem('quality', this.$el)
      .html(
        QualityLevels.buttonTemplate({
          arrowRightIcon,
          currentText: this.currentText,
          currentTier: this.currentTier,
          i18n: this.core.i18n,
        }),
      )
  }

  private get pluginOptions(): QualityLevelsPluginSettings {
    return (
      this.core.options.qualityLevels ?? this.core.options.levelSelector ?? {}
    )
  }

  private get maxLevel() {
    const maxRes = this.pluginOptions.restrictResolution
    return maxRes
      ? (this.levels.find(
          (level) =>
            (level.height > level.width ? level.width : level.height) ===
            maxRes,
        )?.level ?? -1)
      : -1
  }

  private onLevelsAvailable(rawLevels: QualityLevel[]) {
    this.setLevels(rawLevels)
    // Asynchronously select the best codec and re-render with filtered levels.
    // Single-codec streams return null immediately so render() above is the
    // only render. Multi-codec streams get a second render after detection.
    void this.applyCodecPreference(rawLevels)
  }

  private setLevels(levels: QualityLevel[]) {
    const maxResolution = this.pluginOptions.restrictResolution
    this.levels = levels
    this.makeLevelsLabels()
    if (maxResolution) {
      this.removeAuto = true
      const initialLevel = levels
        .filter(
          (level) =>
            (level.width > level.height ? level.height : level.width) <=
            maxResolution,
        )
        .pop()
      this.setLevel(initialLevel?.level ?? 0)
    }
    this.render()
  }

  private async applyCodecPreference(rawLevels: QualityLevel[]): Promise<void> {
    const strategy = this.pluginOptions.codecStrategy ?? 'power-efficient'
    const forcedPrefix =
      this.pluginOptions.preferredCodecPrefix?.toLowerCase() ?? null
    const prefix =
      forcedPrefix ?? (await selectBestCodecPrefix(rawLevels, strategy))
    if (!prefix) return

    // Filter the UI level list to the chosen codec.
    const filtered = rawLevels.filter((l) =>
      l.codec?.toLowerCase().startsWith(prefix),
    )
    if (filtered.length > 0 && filtered.length < rawLevels.length) {
      this.setLevels(filtered)
    }

    // Tell the playback engine which codec HLS.js should prefer internally.
    // setCodecPreference() checks hls.config.videoPreference and is a no-op
    // if the preference is already applied, preventing reload loops.
    const playback = this.core.activePlayback as any
    if (typeof playback.setCodecPreference === 'function') {
      playback.setCodecPreference(prefix)
    }
  }

  private makeLevelsLabels() {
    const labels = this.pluginOptions.labels ?? {}
    this.levelLabels = []

    for (const level of this.levels) {
      const ll = level.width > level.height ? level.height : level.width
      const label = labels[ll] || formatLevelLabel(level)
      this.levelLabels.push(label)
    }
  }

  private onSelect(event: MouseEvent) {
    const selectedLevel = parseInt(
      (event.currentTarget as HTMLElement)?.dataset?.id ?? '-1',
      10,
    )
    this.setLevel(selectedLevel)

    event.stopPropagation()
    event.preventDefault()
    return false
  }

  private goBack() {
    this.core.getPlugin('bottom_gear').refresh()
  }

  private setLevel(index: number) {
    this.selectedLevelId = index
    this.core.activePlayback.currentLevel = this.selectedLevelId
    this.highlightCurrentLevel()
  }

  private allLevelElements() {
    return this.$('#level-selector-menu li') as ZeptoResult
  }

  private levelElement(id = -1) {
    return (
      this.$(`#level-selector-menu a[data-id="${id}"]`) as ZeptoResult
    ).parent()
  }

  private onLevelSwitchStart() {
    this.levelElement(this.selectedLevelId).addClass('changing')
  }

  private onLevelSwitchEnd() {
    this.levelElement(this.selectedLevelId).removeClass('changing')
  }

  private updateText(level: number) {
    this.currentText = this.getLevelLabel(level)
    this.currentTier = this.getLevelTier(level)
    this.updateButton()
    const bottomGear = this.core.getPlugin('bottom_gear') as
      | (BottomGear & { setQualityBadge?: (quality: string) => void })
      | null
    bottomGear?.setQualityBadge?.(this.currentTier)
  }

  private getLevelLabel(id: number): string {
    if (id < 0) {
      return this.core.i18n.t('auto')
    }
    const index = this.levels.findIndex((l) => l.level === id)
    if (index < 0) {
      return this.core.i18n.t('auto')
    }
    return this.levelLabels[index] ?? formatLevelLabel(this.levels[index])
  }

  private getLevelTier(id: number): string {
    if (id < 0) return ''
    const index = this.levels.findIndex((l) => l.level === id)
    if (index < 0) return ''
    const level = this.levels[index]
    const h = level.width > level.height ? level.height : level.width
    return qualityTier(h)
  }

  private onBitrate(info: QualityLevel) {
    this.highlightCurrentLevel()
  }

  private highlightCurrentLevel() {
    this.allLevelElements()
      .removeClass('current')
      .find('a')
      .removeClass('gcore-skin-active')

    const currentLevelElement = this.levelElement(this.selectedLevelId)

    currentLevelElement
      .addClass('current')
      .find('a')
      .addClass('gcore-skin-active')

    this.updateText(this.selectedLevelId)
  }
}

function formatLevelLabel(level: QualityLevel): string {
  const h = level.width > level.height ? level.height : level.width
  return `${h}p ${qualityTier(h)}`
}

function qualityTier(height: number): string {
  if (height >= 2160) return '4K'
  if (height >= 1440) return '2K'
  if (height >= 1080) return 'FHD'
  if (height >= 720) return 'HD'
  if (height >= 420) return 'SD'
  return 'LQ'
}

/**
 * Determines the single best video codec prefix (e.g. `"hvc1"`) for the
 * given level list based on `QualityLevel.codec` strings.
 *
 * With `strategy = 'power-efficient'` (default): uses `MediaCapabilities.decodingInfo`
 * to prefer hardware-accelerated codecs, falling back to `canPlayType`.
 * With `strategy = 'best-supported'`: picks the highest-preference codec the
 * browser can play (AV1 → HEVC → H.264) without checking power efficiency.
 *
 * Returns `null` when all levels share one codec (no filtering needed).
 *
 * Platform behaviour is documented on {@link QualityLevels}.
 */
async function selectBestCodecPrefix(
  levels: QualityLevel[],
  strategy: CodecStrategy = 'power-efficient',
): Promise<string | null> {
  const prefixes = new Set(
    levels
      .map((l) => l.codec?.split('.')[0]?.toLowerCase())
      .filter((p): p is string => !!p),
  )
  if (prefixes.size <= 1) return null

  // Preference order: AV1 → HEVC → H.264 (most efficient compression first)
  const candidates = [
    { prefix: 'av01', codec: 'av01.0.08M.08' },
    { prefix: 'hvc1', codec: 'hvc1.1.6.L120.90' },
    { prefix: 'hev1', codec: 'hev1.1.6.L120.90' },
    { prefix: 'avc1', codec: 'avc1.640032' },
    { prefix: 'avc3', codec: 'avc3.640032' },
  ].filter((c) => prefixes.has(c.prefix))

  if (
    strategy === 'power-efficient' &&
    typeof navigator !== 'undefined' &&
    navigator.mediaCapabilities
  ) {
    for (const c of candidates) {
      try {
        const info = await navigator.mediaCapabilities.decodingInfo({
          type: 'media-source',
          video: {
            contentType: `video/mp4; codecs="${c.codec}"`,
            width: 1920,
            height: 1080,
            bitrate: 5_000_000,
            framerate: 30,
          },
        })
        if (info.supported && info.powerEfficient) return c.prefix
      } catch {
        // MediaCapabilities not supported for this codec — continue
      }
    }
  }

  // best-supported (or power-efficient fallback): first playable codec in preference order
  if (typeof document !== 'undefined') {
    const video = document.createElement('video')
    for (const c of candidates) {
      if (video.canPlayType(`video/mp4; codecs="${c.codec}"`)) return c.prefix
    }
  }

  return null
}
