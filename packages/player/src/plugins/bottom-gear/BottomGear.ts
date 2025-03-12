import { UICorePlugin, template, Events as ClapprEvents, $ } from '@clappr/core'
import { trace } from '@gcorevideo/utils'
import assert from 'assert'

import { CLAPPR_VERSION } from '../../build.js'

import pluginHtml from '../../../assets/bottom-gear/bottomgear.ejs'
import '../../../assets/bottom-gear/gear.scss'
import '../../../assets/bottom-gear/gear-sub-menu.scss'
import gearIcon from '../../../assets/icons/new/gear.svg'
import gearHdIcon from '../../../assets/icons/new/gear-hd.svg'
import { ZeptoResult } from '../../types.js'
import { MediaControlEvents } from '../media-control/MediaControl'

const VERSION = '2.19.12'

const T = 'plugins.bottom_gear'

export enum GearEvents {
  RENDERED = 'rendered',
}

/**
 * An element inside the gear menu
 * @beta
 * @deprecated
 */
export type GearOptionsItem = 'quality' | 'rate' | 'nerd'

/**
 * @deprecated Use {@link GearOptionsItem} instead
 */
export type GearItemElement = GearOptionsItem

// TODO disabled if no items added

/**
 * `PLUGIN` that adds the gear button with an extra options menu on the right side of the {@link MediaControl | media control} UI
 * @beta
 * @remarks
 * The plugins provides a base for attaching custom settings UI in the gear menu
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
  private isHd = false

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
      'click #gear-button': 'toggleGearMenu',
    }
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenToOnce(this.core, ClapprEvents.CORE_READY, this.onCoreReady)
    this.listenTo(
      this.core,
      ClapprEvents.CORE_ACTIVE_CONTAINER_CHANGED,
      this.onActiveContainerChanged,
    )
  }

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
    return $item
  }

  private onActiveContainerChanged() {
    trace(`${T} onActiveContainerChanged`)
    this.bindContainerEvents()
  }

  private bindContainerEvents() {
    trace(`${T} bindContainerEvents`)
    this.listenTo(
      this.core.activeContainer,
      ClapprEvents.CONTAINER_HIGHDEFINITIONUPDATE,
      this.highDefinitionUpdate,
    )
  }

  private highDefinitionUpdate(isHd: boolean) {
    trace(`${T} highDefinitionUpdate`, { isHd })
    this.isHd = isHd
    this.$el.find('.gear-icon').html(isHd ? gearHdIcon : gearIcon)
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
    const icon = this.isHd ? gearHdIcon : gearIcon
    this.$el
      .html(BottomGear.template({ icon }))
      .find('#gear-sub-menu-wrapper')
      .hide()

    // TODO make non-clickable when there are no items
    mediaControl.putElement('gear', this.$el)

    setTimeout(() => {
      this.trigger(GearEvents.RENDERED)
    }, 0)

    return this
  }

  /**
   * Collapses any submenu open back to the gear menu
   */
  refresh() {
    this.$el.find('.gear-sub-menu-wrapper').hide()
    this.$el.find('#gear-options').show()
  }

  private toggleGearMenu() {
    this.$el.find('#gear-options-wrapper').toggle()
  }

  private hide() {
    this.$el.find('#gear-options-wrapper').hide()
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
    this.listenTo(mediaControl, ClapprEvents.MEDIACONTROL_HIDE, this.hide)
  }

  private onMediaControlRendered() {
    trace(`${T} onMediaControlRendered`)
    this.render()
  }
}
