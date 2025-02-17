import { Events, template, UICorePlugin } from '@clappr/core'
import { type QualityLevel } from '@gcorevideo/player'
import { reportError, trace } from '@gcorevideo/utils'
import { CLAPPR_VERSION } from '../build.js'
import { ZeptoResult } from '../types.js'

import buttonHtml from '../../assets/level-selector/button.ejs'
import listHtml from '../../assets/level-selector/list.ejs'
import hdIcon from '../../assets/icons/new/hd.svg'
import arrowRightIcon from '../../assets/icons/new/arrow-right.svg'
import arrowLeftIcon from '../../assets/icons/new/arrow-left.svg'
import checkIcon from '../../assets/icons/new/check.svg'
import '../../assets/level-selector/style.scss'

import pkg from '../../package.json' with { type: 'json' }

const T = 'plugins.level_selector'
const VERSION = pkg.versions.level_selector

type TemplateFunction = (data: Record<string, unknown>) => string

/**
 * Allows to control the quality level of the playback.
 * @beta
 *
 * @remarks
 * The plugin is rendered as a button in the gear menu.
 * When clicked, it shows a list of quality levels to choose from.
 *
 * Configuration options:
 *
 * - `labels`: The labels to show in the level selector. [vertical resolution]: string
 * - `restrictResolution`: The maximum resolution to allow in the level selector.
 * - `title`: The title to show in the level selector.
 *
 * @example
 * ```ts
 * {
 *   levelSelector: {
 *     restrictResolution: 360,
 *     labels: { 360: '360p', 720: '720p' },
 *   },
 * }
 * ```
 */
export class LevelSelector extends UICorePlugin {
  private levels: QualityLevel[] = []

  private levelLabels: string[] = []

  private removeAuto = false

  private isHd = false

  private isOpen = false

  private buttonTemplate: TemplateFunction | null = null

  private listTemplate: TemplateFunction | null = null

  get name() {
    return 'level_selector'
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION }
  }

  static get version() {
    return VERSION
  }

  override get attributes() {
    return {
      class: this.name,
      'data-level-selector': '',
    }
  }

  private currentText = 'Auto'

  private selectedLevelId = -1

  override get events() {
    return {
      'click .gear-sub-menu_btn': 'onLevelSelect',
      'click .gear-option': 'onShowLevelSelectMenu',
      'click .go-back': 'goBack',
    }
  }

  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, () => this.bindPlaybackEvents())
    this.listenTo(this.core, Events.CORE_ACTIVE_CONTAINER_CHANGED, () => this.bindPlaybackEvents())
    this.listenTo(this.core, 'gear:rendered', this.render)
  }

  private unBindEvents() {
    this.stopListening(this.core, Events.CORE_READY, () =>
      this.bindPlaybackEvents(),
    )
    this.stopListening(
      this.core.mediaControl,
      Events.MEDIACONTROL_CONTAINERCHANGED,
      this.reload,
    )
    this.stopListening(this.core, 'gear:rendered', this.render)
  }

  private bindPlaybackEvents() {
    this.removeAuto = false
    this.isHd = false

    const activePlayback = this.core.activePlayback

    this.listenTo(activePlayback, Events.PLAYBACK_LEVELS_AVAILABLE, (levels: QualityLevel[]) =>
      this.fillLevels(levels),
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
    this.listenTo(
      activePlayback,
      Events.PLAYBACK_BITRATE,
      this.updateCurrentLevel,
    )
    this.listenTo(activePlayback, Events.PLAYBACK_STOP, this.onStop)
    this.listenTo(
      activePlayback,
      Events.PLAYBACK_HIGHDEFINITIONUPDATE,
      (isHd: boolean) => {
        this.isHd = isHd
        this.deferRender()
      },
    )
    if (activePlayback?.levels?.length > 0) {
      this.fillLevels(activePlayback.levels)
    }
  }

  private onStop() {
    trace(`${T} onStop`)
    const currentPlayback = this.core.activePlayback

    this.listenToOnce(currentPlayback, Events.PLAYBACK_PLAY, () => {
      trace(`${T} on PLAYBACK_PLAY after stop`, { selectedLevelId: this.selectedLevelId })
      if (currentPlayback.getPlaybackType() === 'live') {
        if (this.selectedLevelId !== -1) {
          currentPlayback.currentLevel = this.selectedLevelId
        }
      }
    })
  }

  private reload() {
    this.unBindEvents()
    this.bindEvents()
    this.bindPlaybackEvents()
  }

  private shouldRender() {
    if (!this.core.activeContainer) {
      return false
    }

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

  override render() {
    if (!this.shouldRender()) {
      return this
    }

    this.renderButton()

    return this
  }

  private renderButton() {
    if (!this.buttonTemplate) {
      this.buttonTemplate = template(buttonHtml)
    }

    if (!this.isOpen) {
      const html = this.buttonTemplate?.({
        arrowRightIcon,
        currentText: this.currentText,
        isHd: this.isHd,
        hdIcon,
      })
      this.$el.html(html)
      this.core.mediaControl.$el
        ?.find('.gear-options-list [data-quality]')
        .html(this.el)
    }
  }

  private renderDropdown() {
    if (!this.listTemplate) {
      this.listTemplate = template(listHtml)
    }
    const html = this.listTemplate!({
      arrowLeftIcon,
      checkIcon,
      labels: this.levelLabels,
      levels: this.levels,
      maxLevel: this.maxLevel,
      removeAuto: this.removeAuto,
    })
    this.$el.html(html)
    this.core.mediaControl.$el?.find('.gear-wrapper').html(this.el)
  }

  private get maxLevel() {
    const maxRes = this.core.options.levelSelector?.restrictResolution
    return maxRes
      ? this.levels.findIndex(
          (level) =>
            level.height === maxRes,
        )
      : -1
  }

  private fillLevels(levels: QualityLevel[]) {
    const maxResolution = this.core.options.levelSelector?.restrictResolution
    this.levels = levels
    this.makeLevelsLabels()
    if (maxResolution) {
      this.removeAuto = true
      // TODO account for vertical resolutions, i.e, normalize the resolution to the width
      const initialLevel = levels
        .filter((level) => level.height <= maxResolution)
        .pop()
      this.setLevel(initialLevel?.level ?? 0)
    }
    this.deferRender()
  }

  private makeLevelsLabels() {
    const labels = this.core.options.levelSelector?.labels ?? {}
    this.levelLabels = []

    for (let i = 0; i < this.levels.length; i++) {
      const level = this.levels[i]
      const ll = level.width > level.height ? level.height : level.width
      const label = labels[ll] || `${ll}p`
      this.levelLabels.push(label)
    }
  }

  private findLevelBy(id: number): QualityLevel | undefined {
    return this.levels.find((level) => level.level === id)
  }

  private onLevelSelect(event: MouseEvent) {
    const selectedLevel = parseInt(
      (event.currentTarget as HTMLElement)?.dataset?.id ?? '-1',
      10,
    )
    this.setLevel(selectedLevel)
    event.stopPropagation()
    return false
  }

  private goBack() {
    trace(`${T} goBack`)
    this.isOpen = false
    this.core.trigger('gear:refresh')
    this.deferRender()
  }

  private setLevel(index: number) {
    trace(`${T} setIndexLevel`, { index })
    this.selectedLevelId = index
    if (!this.core.activePlayback) {
      return
    }
    if (this.core.activePlayback.currentLevel === this.selectedLevelId) {
      return
    }
    this.core.activePlayback.currentLevel = this.selectedLevelId

    try {
      this.highlightCurrentLevel()
    } catch (error) {
      reportError(error)
    }
    this.deferRender()
  }

  private onShowLevelSelectMenu() {
    trace(`${T} onShowLevelSelectMenu`)
    this.isOpen = true
    this.renderDropdown()
    this.highlightCurrentLevel()
  }

  private allLevelElements() {
    return this.$('ul.gear-sub-menu li') as ZeptoResult
  }

  private levelElement(id = -1) {
    return (
      this.$(`ul.gear-sub-menu a[data-id="${id}"]`) as ZeptoResult
    ).parent()
  }

  private getTitle() {
    return (this.core.options.levelSelector || {}).title
  }

  private onLevelSwitchStart() {
    this.core.activePlayback.trigger('playback:level:select:start')
    this.levelElement(this.selectedLevelId).addClass('changing')
  }

  private onLevelSwitchEnd() {
    this.levelElement(this.selectedLevelId).removeClass('changing')
  }

  private updateText(level: number) {
    if (level === undefined || isNaN(level)) {
      return
    }
    this.currentText = this.getLevelLabel(level)
    this.deferRender()
  }

  private getLevelLabel(id: number): string {
    if (id === -1) {
      return 'Auto'
    }
    const index = this.levels.findIndex((l) => l.level === id)
    if (index < 0) {
      return 'Auto'
    }
    return this.levelLabels[index] ?? formatLevelLabel(this.levels[index])
  }

  private updateCurrentLevel(info: QualityLevel) {
    trace(`${T} updateCurrentLevel`, { info })
    this.highlightCurrentLevel()
  }

  private highlightCurrentLevel() {
    trace(`${T} highlightCurrentLevel`, {
      selectedLevelId: this.selectedLevelId,
    })
    this.allLevelElements().removeClass('current')
    this.allLevelElements().find('a').removeClass('gcore-skin-active')

    const currentLevelElement = this.levelElement(this.selectedLevelId)

    currentLevelElement.addClass('current')
    currentLevelElement.find('a').addClass('gcore-skin-active')

    this.updateText(this.selectedLevelId)
  }

  private deferRender = debounce(() => this.render(), 0)
}

function formatLevelLabel(level: QualityLevel): string {
  const h = level.width > level.height ? level.height : level.width
  return `${h}p`
}

function debounce(fn: () => void, wait: number) {
  let timerId: ReturnType<typeof setTimeout> | null = null
  return function () {
    if (timerId !== null) {
      clearTimeout(timerId)
    }
    timerId = setTimeout(() => {
      timerId = null
      fn()
    }, wait)
  }
}
