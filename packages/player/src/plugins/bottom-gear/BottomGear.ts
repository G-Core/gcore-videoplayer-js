import { UICorePlugin, template, Events } from '@clappr/core';
import { trace } from '@gcorevideo/utils';
import assert from 'assert';

import { CLAPPR_VERSION } from '../../build.js';

import pluginHtml from '../../../assets/bottom-gear/bottomgear.ejs';
import '../../../assets/bottom-gear/gear.scss';
import '../../../assets/bottom-gear/gear-sub-menu.scss';
import gearIcon from '../../../assets/icons/new/gear.svg';
import gearHdIcon from '../../../assets/icons/new/gear-hd.svg';

const VERSION = '2.19.12';

const T = 'plugins.media_control_gear';

/**
 * Adds the gear button that triggers extra options menu on the right side of the {@link MediaControl | media control} UI
 * @beta
 * @remarks
 * The plugins provides a base for attaching custom settings UI in the gear menu
 */
export class BottomGear extends UICorePlugin {
  private isHd = false;

  /**
   * @internal
   */
  get name() {
    return 'media_control_gear';
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
      'class': this.name,
      'data-track-selector': ''
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
    const mediaControl = this.core.getPlugin('media_control');
    assert(mediaControl, 'media_control plugin is required');

    this.listenTo(this.core, Events.CORE_ACTIVE_CONTAINER_CHANGED, this.onActiveContainerChanged);
    this.listenTo(this.core, 'gear:refresh', this.refresh); // TODO use direct plugin method call
    // this.listenTo(mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.reload);
    this.listenTo(mediaControl, Events.MEDIACONTROL_RENDERED, this.render);
    this.listenTo(mediaControl, Events.MEDIACONTROL_HIDE, this.hide); // TODO mediacontrol show as well
    this.bindContainerEvents();
  }

  private onActiveContainerChanged() {
    this.bindContainerEvents();
  }

  private bindContainerEvents() {
    trace(`${T} bindContainerEvents`);
    this.listenTo(this.core.activeContainer, Events.CONTAINER_HIGHDEFINITIONUPDATE, this.highDefinitionUpdate);
  }

  private highDefinitionUpdate(isHd: boolean) {
    trace(`${this.name} highDefinitionUpdate`, { isHd });
    this.isHd = isHd;
    if (isHd) {
      this.$el.find('.gear-icon').html(gearHdIcon);
    } else {
      this.$el.find('.gear-icon').html(gearIcon);
    }
  }

  /**
   * @internal
   */
  override render() {
    const mediaControl = this.core.getPlugin('media_control');
    assert(mediaControl, 'media_control plugin is required');

    // TODO use options.mediaControl.gear.items
    const items = [
      'quality',
      'rate',
      'nerd',
    ];
    const icon = this.isHd ? gearHdIcon : gearIcon;
    this.$el.html(BottomGear.template({ icon, items }));

    mediaControl.getElement('bottomGear')?.html(this.el);
    this.core.trigger('gear:rendered'); // TODO trigger on mediaControl instead

    return this;
  }

  private refresh() {
    this.render();
    this.$el.find('.gear-wrapper').show();
  }

  private toggleGearMenu() {
    this.$el.find('.gear-wrapper').toggle();
  }

  private hide() {
    this.$el.find('.gear-wrapper').hide();
  }
}
