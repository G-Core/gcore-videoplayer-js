import {
  Events,
  template,
  $,
  Container,
  UIContainerPlugin,
} from '@clappr/core'

import { CLAPPR_VERSION } from '../../build.js'

import '../../../assets/context-menu/context_menu.scss'
import templateHtml from '../../../assets/context-menu/context_menu.ejs'
import { version } from '../../version.js'

type MenuOption = {
  label: string
  name: string
}

/**
 * The plugin adds a context menu to the player.
 * @beta
 */
export interface ContextMenuPluginSettings {
  label?: string
  url?: string
  preventShowContextMenu?: boolean
}

/**
 * Displays a small context menu when clicked on the player container.
 * @beta
 * @remarks
 * Configuration options - {@link ContextMenuPluginSettings}
 */
export class ContextMenu extends UIContainerPlugin {
  private _label: string = ''

  private _url: string = ''

  private menuOptions: MenuOption[] = []

  /**
   * @internal
   */
  get name() {
    return 'context_menu'
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
  override get attributes() {
    return { class: 'context-menu' }
  }

  private static readonly template = template(templateHtml)

  private get label() {
    return this._label || 'Gcore player ver. ' + version().gplayer
  }

  private get url() {
    return this._url || 'https://gcore.com/'
  }

  private get exposeVersion() {
    return {
      label: this.label,
      name: 'version',
    }
  }

  /**
   * @internal
   */
  override get events() {
    return {
      'click [data-version]': 'onOpenMainPage',
    }
  }

  constructor(container: Container) {
    super(container)
    if (this.options.contextMenu && this.options.contextMenu.label) {
      this._label = this.options.contextMenu.label
    }
    if (this.options.contextMenu && this.options.contextMenu.url) {
      this._url = this.options.contextMenu.url
    }
    this.render()
    $('body').on('click', this.hideOnBodyClick)
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(
      this.container,
      Events.CONTAINER_CONTEXTMENU,
      this.toggleContextMenu,
    )
    this.listenTo(this.container, Events.CONTAINER_CLICK, this.hide)
  }

  /**
   * @internal
   */
  override destroy() {
    $('body').off('click', this.hideOnBodyClick)
    return super.destroy()
  }

  private toggleContextMenu(event: MouseEvent) {
    event.preventDefault()
    const offset = this.container?.$el.offset()

    this.show(event.pageY - offset.top, event.pageX - offset.left)
  }

  private show(top: number, left: number) {
    this.hide()
    if (
      this.options.contextMenu &&
      this.options.contextMenu.preventShowContextMenu
    ) {
      return
    }
    this.$el.css({ top, left })
    this.$el.show()
  }

  private hide() {
    this.$el.hide()
  }

  private onOpenMainPage() {
    window.open(this.url, '_blank')
  }

  /**
   * @internal
   */
  override render() {
    this.menuOptions = [this.exposeVersion]
    this.$el.html(ContextMenu.template({ options: this.menuOptions }))
    this.container.$el.append(this.$el) // TODO append to the container, turn into a container plugin
    this.hide()

    return this
  }

  private hideOnBodyClick = () => {
    this.hide()
  }
}
