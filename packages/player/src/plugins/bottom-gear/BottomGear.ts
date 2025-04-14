import { UICorePlugin, template, Events as ClapprEvents, $, Container } from '@clappr/core'
import { trace } from '@gcorevideo/utils'
import assert from 'assert'

import { CLAPPR_VERSION } from '../../build.js'

import pluginHtml from '../../../assets/bottom-gear/bottomgear.ejs'
import '../../../assets/bottom-gear/gear.scss'
import '../../../assets/bottom-gear/gear-sub-menu.scss'
import gearIcon from '../../../assets/icons/new/gear.svg'
import gearHdIcon from '../../../assets/icons/new/gear-hd.svg'
import { ZeptoResult } from '../../types.js'
import { ExtendedEvents } from '../media-control/MediaControl.js'

const VERSION = '2.19.12'

const T = 'plugins.bottom_gear'

/**
 * Events triggered by the plugin
 * @beta
 */
export enum GearEvents {
  /**
   * Subscribe to this event to accurately attach an item to the gear menu
   */
  RENDERED = 'rendered',
}

// TODO disabled if no items added

/**
 * `PLUGIN` that adds a button to extend the media controls UI with extra options.
 * @beta
 * @remarks
 * The plugin renders small gear icon to the right of the media controls.
 * It provides a base for attaching custom settings UI in the gear menu
 *
 * Depends on:
 *
 * - {@link MediaControl}
 *
 * @example
 * You can use bottom gear to add custom settings UI to the gear menu.
 *
 * ```ts
 * import { BottomGear } from '@gcorevideo/player/plugins/bottom-gear';
 *
 * class CustomOptionsPlugin extends UICorePlugin {
 *   // ...
 *
 *   override get events() {
 *     return {
 *       'click #my-button': 'doMyAction',
 *     }
 *   }
 *
 *   private doMyAction() {
 *     // ...
 *   }
 *
 *   override render() {
 *     const bottomGear = this.core.getPlugin('bottom_gear');
 *     if (!bottomGear) {
 *       return this;
 *     }
 *     this.$el.html('<button class="custom-option">Custom option</button>');
 *     // Put rendered element into the gear menu
 *     bottomGear.addItem('custom').html(this.$el)
 *     return this;
 *   }
 *
 *   // alternatively, add an option with a submenu
 *   override render() {
 *     this.$el.html(template(templateHtml)({
 *       // ...
 *     })));
 *     return this;
 *   }
 *
 *   private addGearOption() {
 *     this.core.getPlugin('bottom_gear')
 *       .addItem('custom', this.$el)
 *       .html($('<button class="custom-option">Custom option</button>'))
 *   }
 *
 *   override bindEvents() {
 *     this.listenToOnce(this.core, ClapprEvents.CORE_READY, () => {
 *       const bottomGear = this.core.getPlugin('bottom_gear');
 *       assert(bottomGear, 'bottom_gear plugin is required');
 *       // simple case
 *       this.listenTo(bottomGear, GearEvents.RENDERED, this.render);
 *       // or with a submenu
 *       this.listenTo(bottomGear, GearEvents.RENDERED, this.addGearOption);
 *      });
 *   }
 * }
 * ```
 */
export class BottomGear extends UICorePlugin {
  private hd = false

  private numItems = 0;

  private collapsed = true;

  /**
   * @internal
   */
  get name() {
    return 'bottom_gear'
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

  private static readonly template = template(pluginHtml)

  /**
   * @internal
   */
  override get attributes() {
    return {
      class: 'media-control-gear',
    }
  }

  /**
   * @internal
   */
  override get events() {
    return {
      'click #gear-button': 'toggleMenu',
    }
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenToOnce(this.core, ClapprEvents.CORE_READY, this.onCoreReady)
  }

  /**
   * Adds a custom option to the gear menu
   * @param name - A unique name of the option
   * @param $subMenu - The submenu to attach to the option
   * @returns The added item placeholder to attach custom markup
   * @remarks
   * When called with $submenu param, a click on the added item will toggle the submenu visibility.
   *
   * When added without submenu, it's responsibility of the caller to handle the click event however needed.
   * @example
   * ```ts
   * class MyPlugin extends UICorePlugin {
   *   override render() {
   *     this.$el.html('<div class="my-awesome-settings">...</div>')
   *     this.core.getPlugin('bottom_gear')
   *       ?.addItem('custom', this.$el)
   *       .html($('<button>Custom settings</button>'))
   *     return this
   *   }
   * }
   * ```
   */
  addItem(name: string, $subMenu?: ZeptoResult): ZeptoResult {
    const $existingItem = this.$el.find(`#gear-options li[data-${name}`)
    if ($existingItem.length) {
      trace(`${T} addItem already exists`, { name })
      return $existingItem
    }
    const $item = $('<li></li>')
      .attr(`data-${name}`, '')
      .appendTo(this.$el.find('#gear-options'))
    if ($subMenu) {
      trace(`${T} addItem adding submenu`, { name })
      $subMenu
        .addClass('gear-sub-menu-wrapper')
        .hide()
        .appendTo(this.$el.find('#gear-options-wrapper'))
      $item.on('click', (e: MouseEvent) => {
        trace(`${T} addItem submenu clicked`, { name })
        e.stopPropagation()
        $subMenu.show()
        this.$el.find('#gear-options').hide()
      })
    }
    this.numItems++;
    if (this.numItems > 0) {
      this.$el.show()
    }
    return $item
  }

  private bindContainerEvents(container: Container) {
    trace(`${T} bindContainerEvents`)
    this.listenTo(
      container,
      ClapprEvents.CONTAINER_HIGHDEFINITIONUPDATE,
      this.highDefinitionUpdate,
    )
    this.listenTo(container, ClapprEvents.CONTAINER_CLICK, () => {
      this.collapse()
    })
  }

  private highDefinitionUpdate(isHd: boolean) {
    trace(`${T} highDefinitionUpdate`, { isHd })
    this.hd = isHd
    this.$el.find('#gear-button').html(isHd ? gearHdIcon : gearIcon)
  }

  /**
   * @internal
   */
  override render() {
    trace(`${T} render`)
    const mediaControl = this.core.getPlugin('media_control')
    if (!mediaControl) {
      return this // TODO test
    }
    const icon = this.hd ? gearHdIcon : gearIcon
    this.collapsed = true;
    this.numItems = 0;
    this.$el
      .html(BottomGear.template({ icon }))
      .hide() // until numItems > 0
      .find('#gear-options-wrapper')
      .hide()

    setTimeout(() => {
      this.trigger(GearEvents.RENDERED)
    }, 0)

    return this
  }

  /**
   * Collapses any submenu open back to the gear menu.
   * @remarks
   * Should be called by the UI plugin that added a gear item with a submenu when the latter is closed (e.g., when a "back" button is clicked).
   */
  refresh() {
    this.collapseSubmenus()
  }

  private collapseSubmenus() {
    this.$el.find('.gear-sub-menu-wrapper').hide()
    this.$el.find('#gear-options').show()
  }

  private toggleMenu() {
    this.core
      .getPlugin('media_control')
      .trigger(ExtendedEvents.MEDIACONTROL_MENU_COLLAPSE, this.name)
    this.collapsed = !this.collapsed;
    if (this.collapsed) {
      this.$el.find('#gear-options-wrapper').hide()
    } else {
      this.$el.find('#gear-options-wrapper').show()
    }
    this.$el.find('#gear-button').attr('aria-expanded', (!this.collapsed).toString())
    trace(`${T} toggleMenu`, { hidden: this.collapsed })
  }

  private collapse() {
    trace(`${T} collapse`)
    this.collapsed = true;
    this.$el.find('#gear-options-wrapper').hide()
    this.$el.find('#gear-button').attr('aria-expanded', 'false')
    // TODO hide submenus
    this.collapseSubmenus()
  }

  private onCoreReady() {
    trace(`${T} onCoreReady`)
    const mediaControl = this.core.getPlugin('media_control')
    assert(mediaControl, 'media_control plugin is required')
    this.listenTo(
      mediaControl,
      ClapprEvents.MEDIACONTROL_RENDERED,
      this.onMediaControlRendered,
    )
    this.listenTo(mediaControl, ClapprEvents.MEDIACONTROL_HIDE, this.collapse)
    this.listenTo(mediaControl, ClapprEvents.MEDIACONTROL_CONTAINERCHANGED, () => {
      this.bindContainerEvents(mediaControl.container)
    })
    this.listenTo(
      mediaControl,
      ExtendedEvents.MEDIACONTROL_MENU_COLLAPSE,
      (from: string) => {
        if (from !== this.name) {
          this.collapse()
        }
      },
    )
    this.bindContainerEvents(mediaControl.container)
  }

  private onMediaControlRendered() {
    trace(`${T} onMediaControlRendered`)
    this.mount()
  }

  private mount() {
    trace(`${T} mount`, {
      numItems: this.numItems,
    })
    const mediaControl = this.core.getPlugin('media_control')
    mediaControl.mount('gear', this.$el)
  }
}
