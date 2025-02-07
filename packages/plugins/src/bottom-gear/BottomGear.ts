import { UICorePlugin, template, Events } from '@clappr/core';
import { trace } from '@gcorevideo/utils';

import { CLAPPR_VERSION } from '../build.js';

import pluginHtml from '../../assets/bottom-gear/bottomgear.ejs';
import '../../assets/bottom-gear/gear.scss';
import '../../assets/bottom-gear/gear-sub-menu.scss';
import gearIcon from '../../assets/icons/new/gear.svg';
import gearHdIcon from '../../assets/icons/new/gear-hd.svg';

const VERSION = '0.0.1';

export class BottomGear extends UICorePlugin {
  private isHd = false;

  get name() {
    return 'gear';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  static get version() {
    return VERSION;
  }

  get template() {
    return template(pluginHtml);
  }

  override get attributes() {
    return {
      'class': this.name,
      'data-track-selector': ''
    };
  }

  override get events() {
    return {
      'click .button-gear': 'toggleGearMenu',
    };
  }

  get container() {
    return this.core && this.core.activeContainer;
  }

  // constructor(core) {
  //   super(core);
  //   this.isHd = false;
  // }

  override bindEvents() {
    this.listenTo(this.core, Events.CORE_ACTIVE_CONTAINER_CHANGED, this.onActiveContainerChanged);
    this.listenTo(this.core, 'gear:refresh', this.refresh);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.reload);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_RENDERED, this.render);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_HIDE, this.hide);
    this.bindContainerEvents();
  }

  unBindEvents() {
    this.stopListening(this.core, Events.CORE_ACTIVE_CONTAINER_CHANGED, this.onActiveContainerChanged);
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.reload);
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_RENDERED, this.render);
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_HIDE, this.hide);
  }

  private onActiveContainerChanged() {
    this.bindEvents();
    this.bindContainerEvents();
  }

  private bindContainerEvents() {
    if (!this.container) {
      return;
    }
    this.listenTo(this.container, Events.CONTAINER_HIGHDEFINITIONUPDATE, this.highDefinitionUpdate);
  }

  reload() {
    this.unBindEvents();
    this.bindEvents();
  }

  private highDefinitionUpdate(isHd: boolean) {
    this.isHd = isHd;
    if (isHd) {
      this.$el.find('.gear-icon').html(gearHdIcon);
    } else {
      this.$el.find('.gear-icon').html(gearIcon);
    }
  }

  override render() {
    const items = [
      'quality',
      'rate',
      'nerd',
    ];

    const icon = this.isHd ? gearHdIcon : gearIcon;

    this.$el.html(this.template({ icon, items }));

    this.core.mediaControl.$bottomGear?.html(this.el);
    this.core.trigger('gear:rendered');

    return this;
  }

  refresh() {
    this.render();
    this.$el.find('.gear-wrapper').show();
  }

  toggleGearMenu() {
    this.$el.find('.gear-wrapper').toggle();
  }

  hide() {
    this.$el.find('.gear-wrapper').hide();
  }
}
