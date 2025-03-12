import { Events, template, UICorePlugin } from '@clappr/core'
import { reportError, trace } from '@gcorevideo/utils'
import assert from 'assert'

import { type QualityLevel } from '../../playback.types.js'
import { CLAPPR_VERSION } from '../../build.js'
import { ZeptoResult } from '../../types.js'
import { TemplateFunction } from '../types.js'
import { BottomGear, GearEvents } from '../bottom-gear/BottomGear.js'

import buttonHtml from '../../../assets/level-selector/button.ejs'
import listHtml from '../../../assets/level-selector/list.ejs'
import hdIcon from '../../../assets/icons/new/hd.svg'
import arrowRightIcon from '../../../assets/icons/new/arrow-right.svg'
import arrowLeftIcon from '../../../assets/icons/new/arrow-left.svg'
import checkIcon from '../../../assets/icons/new/check.svg'
import '../../../assets/level-selector/style.scss'
import { MediaControl } from '../media-control/MediaControl.js'

const T = 'plugins.level_selector'
const VERSION = '2.19.4'

/**
 * Configuration options for the {@link LevelSelector | level selector} plugin.
 * @beta
 */
export interface LevelSelectorPluginSettings {
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
}

/**
 * `PLUGIN` that provides a UI to select the desired quality level of the playback.
 * @beta
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
 * Configuration options - {@link LevelSelectorPluginSettings}
 *
 * @example
 * ```ts
 * new Player({
 *   levelSelector: {
 *     restrictResolution: 360,
 *     labels: { 360: 'SD', 720: 'HD' },
 *   },
 * })
 * ```
 */
export class LevelSelector extends UICorePlugin {
  private levels: QualityLevel[] = []

  private levelLabels: string[] = []

  private removeAuto = false

  private isHd = false

  private currentText = ''

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
    trace(`${T} onCoreReady`)
    const gear = this.core.getPlugin('bottom_gear') as BottomGear
    assert(gear, 'bottom_gear plugin is required')

    this.currentText = this.core.i18n.t('auto')
    this.listenTo(gear, GearEvents.RENDERED, this.onGearRendered)
  }

  private onGearRendered() {
    trace(`${T} onGearRendered`)
    this.render()
  }

  private onActiveContainerChange() {
    this.removeAuto = false
    this.isHd = false

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
    this.listenTo(
      activePlayback,
      Events.PLAYBACK_HIGHDEFINITIONUPDATE,
      (isHd: boolean) => {
        this.isHd = isHd
        this.updateHd()
      },
    )
    if (activePlayback.levels?.length > 0) {
      this.onLevelsAvailable(activePlayback.levels)
    }
  }

  private updateHd() {
    if (this.isHd) {
      this.$el.find('.gear-option_hd-icon').removeClass('hidden')
    } else {
      this.$el.find('.gear-option_hd-icon').addClass('hidden')
    }
  }

  private onStop() {
    trace(`${T} onStop`)
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
      return this
    }
    this.renderDropdown()
    this.updateButton()

    return this
  }

  private renderDropdown() {
    this.$el.html(
      LevelSelector.listTemplate({
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
    ;(this.core.getPlugin('bottom_gear') as BottomGear)
      ?.addItem('quality', this.$el)
      .html(
        LevelSelector.buttonTemplate({
          arrowRightIcon,
          currentText: this.currentText,
          isHd: this.isHd,
          hdIcon,
          i18n: this.core.i18n,
        }),
      )
  }

  private get maxLevel() {
    const maxRes = this.core.options.levelSelector?.restrictResolution
    return maxRes
      ? this.levels.find(
          (level) =>
            (level.height > level.width ? level.width : level.height) ===
            maxRes,
        )?.level ?? -1
      : -1
  }

  private onLevelsAvailable(levels: QualityLevel[]) {
    const maxResolution = this.core.options.levelSelector?.restrictResolution
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

  private makeLevelsLabels() {
    const labels = this.core.options.levelSelector?.labels ?? {}
    this.levelLabels = []

    for (const level of this.levels) {
      const ll = level.width > level.height ? level.height : level.width
      const label = labels[ll] || `${ll}p`
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
    trace(`${T} goBack`)
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
    this.updateButton()
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

  private onBitrate(info: QualityLevel) {
    trace(`${T} updateCurrentLevel`, { info })
    this.highlightCurrentLevel()
  }

  private highlightCurrentLevel() {
    trace(`${T} highlightCurrentLevel`, {
      selectedLevelId: this.selectedLevelId,
    })
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
  return `${h}p`
}
