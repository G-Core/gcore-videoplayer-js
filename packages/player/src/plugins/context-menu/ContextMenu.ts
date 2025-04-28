import { Events, template, $, Container, UIContainerPlugin } from '@clappr/core'

import { CLAPPR_VERSION } from '../../build.js'

import '../../../assets/context-menu/context_menu.scss'
import templateHtml from '../../../assets/context-menu/context_menu.ejs'

/**
 * @public
 */
export type MenuOption = {
  /**
   * Menu item label text. One of `label` or `labelKey` must be specified.
   */
  label?: string
  /**
   * Menu item label localisation key, if specified, the `label` will be ignored
   */
  labelKey?: string
  /**
   * Menu item name. Must be unique.
   */
  name: string
  /**
   * Menu item handler function
   */
  handler?: () => void
  /**
   * Menu item icon, plain HTML string
   */
  icon?: string
}

/**
 * Context menu plugin settings
 * @beta
 */
export interface ContextMenuPluginSettings {
  options?: MenuOption[]
}

const T = 'plugins.context_menu'

/**
 * `PLUGIN` that displays a small context menu when clicked on the player container.
 * @beta
 * @remarks
 * Configuration options - {@link ContextMenuPluginSettings}
 *
 * Should not be used together with {@link ClickToPause} plugin
 */
export class ContextMenu extends UIContainerPlugin {
  private open = false

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

  /**
   * @internal
   */
  override get events() {
    return {
      'click [role="menuitem"]': 'runAction',
    }
  }

  constructor(container: Container) {
    super(container)
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
      this.onContextMenu,
    )
    this.listenTo(this.container, Events.CONTAINER_CLICK, this.onContainerClick)
  }

  /**
   * @internal
   */
  override destroy() {
    $('body').off('click', this.hideOnBodyClick)
    return super.destroy()
  }

  private onContainerClick() {
    this.hide()
  }

  private onContextMenu(event: MouseEvent) {
    if (!this.options.contextMenu?.options?.length) {
      return
    }
    event.preventDefault()
    event.stopPropagation()

    const offset = this.container?.$el.offset()
    this.show(event.pageY - offset.top, event.pageX - offset.left)
  }

  private show(top: number, left: number) {
    this.open = true
    this.$el.css({ top, left })
    this.$el.show()
  }

  private hide() {
    this.open = false
    this.$el.hide()
  }

  private runAction(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()

    const itemName = (event.currentTarget as HTMLButtonElement).dataset.name
    if (!itemName) {
      return
    }
    const item = this.options.contextMenu?.options.find(
      (option: MenuOption) => option.name === itemName,
    )
    if (item?.handler) {
      item.handler()
    }
    this.hide()
  }

  /**
   * @internal
   */
  override render() {
    if (!this.options.contextMenu?.options?.length) {
      return this
    }
    const options = this.options.contextMenu.options
    this.$el.html(
      ContextMenu.template({
        options,
        i18n: this.container.i18n,
        iconic: options.some((option: MenuOption) => option.icon),
      }),
    )
    this.container.$el.append(this.$el) // TODO append to the container, turn into a container plugin
    this.$el.hide()

    return this
  }

  private hideOnBodyClick = () => {
    this.hide()
  }
}
