import { UICorePlugin, template, Events as ClapprEvents } from '@clappr/core';
import { trace } from '@gcorevideo/utils';
import assert from 'assert';

import { CLAPPR_VERSION } from '../../build.js';

import pluginHtml from '../../../assets/bottom-gear/bottomgear.ejs';
import '../../../assets/bottom-gear/gear.scss';
import '../../../assets/bottom-gear/gear-sub-menu.scss';
import gearIcon from '../../../assets/icons/new/gear.svg';
import gearHdIcon from '../../../assets/icons/new/gear-hd.svg';
import { ZeptoResult } from '../../types.js';
import { MediaControlEvents } from '../media-control/MediaControl';

const VERSION = '2.19.12';

const T = 'plugins.bottom_gear';

/**
 * An element inside the gear menu
 * @beta
 */
export type GearItemElement = 'quality' | 'rate' | 'nerd';

/**
 * `PLUGIN` that adds the gear button with an extra options menu on the right side of the {@link MediaControl | media control} UI
 * @beta
 * @remarks
 * The plugins provides a base for attaching custom settings UI in the gear menu
 * 
 * Depends on:
 *
 * - {@link MediaControl | media_control}
 */
export class BottomGear extends UICorePlugin {
  private isHd = false;

  /**
   * @internal
   */
  get name() {
    return 'bottom_gear';
  }

  /**
   * @internal
   */
  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  /**
   * @internal
   */
  static get version() {
    return VERSION;
  }

  private static readonly template = template(pluginHtml)

  /**
   * @internal
   */
  override get attributes() {
    return {
      'class': 'media-control-gear',
    };
  }

  /**
   * @internal
   */
  override get events() {
    return {
      'click .button-gear': 'toggleGearMenu',
    };
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.core, ClapprEvents.CORE_READY, this.onCoreReady)
    this.listenTo(this.core, ClapprEvents.CORE_ACTIVE_CONTAINER_CHANGED, this.onActiveContainerChanged);
  }

  /**
   * @param name - Name of a gear menu placeholder item to attach custom UI
   * @returns Zepto result of the element
   */
  getElement(name: GearItemElement): ZeptoResult | null {
    return this.$el.find(`.gear-options-list [data-${name}]`);
  }

  /**
   * Replaces the content of the gear menu
   * @param content - Zepto result of the element
   */
  setContent(content: ZeptoResult) {
    this.$el.find('.gear-wrapper').html(content);
  }

  private onActiveContainerChanged() {
    trace(`${T} onActiveContainerChanged`);
    this.bindContainerEvents();
  }

  private bindContainerEvents() {
    trace(`${T} bindContainerEvents`);
    this.listenTo(this.core.activeContainer, ClapprEvents.CONTAINER_HIGHDEFINITIONUPDATE, this.highDefinitionUpdate);
  }

  private highDefinitionUpdate(isHd: boolean) {
    trace(`${T} highDefinitionUpdate`, { isHd });
    this.isHd = isHd;
    this.$el.find('.gear-icon').html(isHd ? gearHdIcon : gearIcon);
  }

  /**
   * @internal
   */
  override render() {
    const mediaControl = this.core.getPlugin('media_control');

    // TODO use options.mediaControl.gear.items
    const items: GearItemElement[] = [
      'quality',
      'rate',
      'nerd',
    ];
    const icon = this.isHd ? gearHdIcon : gearIcon;
    this.$el.html(BottomGear.template({ icon, items }));

    mediaControl.putElement('gear', this.$el);
    mediaControl.trigger(MediaControlEvents.MEDIACONTROL_GEAR_RENDERED);
    return this;
  }

  /**
   * Re-renders the gear menu.
   * It fires the {@link MediaControlEvents.MEDIACONTROL_GEAR_RENDERED | MEDIACONTROL_GEAR_RENDERED} event,
   * which the plugins that attach to the gear menu can listen to to re-render themselves.
   */
  refresh() {
    this.render();
    this.$el.find('.gear-wrapper').show();
  }

  private toggleGearMenu() {
    this.$el.find('.gear-wrapper').toggle();
  }

  private hide() {
    this.$el.find('.gear-wrapper').hide();
  }

  private onCoreReady() {
    const mediaControl = this.core.getPlugin('media_control');
    assert(mediaControl, 'media_control plugin is required');
    this.listenTo(mediaControl, ClapprEvents.MEDIACONTROL_RENDERED, this.render);
    this.listenTo(mediaControl, ClapprEvents.MEDIACONTROL_HIDE, this.hide); // TODO mediacontrol show as well
  }
}
