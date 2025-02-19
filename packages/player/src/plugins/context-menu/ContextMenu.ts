import { UICorePlugin, Events, template, $, Core, Container } from '@clappr/core';

import { CLAPPR_VERSION } from '../../build.js';

import '../../../assets/context-menu/context_menu.scss';
import templateHtml from '../../../assets/context-menu/context_menu.ejs';

type MenuOption = {
  label: string;
  name: string;
}

export class ContextMenu extends UICorePlugin {
  private _label: string = '';

  private _url: string = '';

  private container: Container | null = null;

  private menuOptions: MenuOption[] = [];

  get name() {
    return 'context_menu';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  override get attributes() {
    return { 'class': 'context-menu' };
  }

  get mediaControl() {
    return this.core.mediaControl;
  }

  get template() {
    return template(templateHtml);
  }

  get label() {
    return this._label || 'Gcore player ver. ' + process.env.VERSION;
  }

  get url() {
    return this._url || 'https://gcore.com/';
  }

  get exposeVersion() {
    return {
      label: this.label,
      name: 'version'
    };
  }

  override get events() {
    return {
      'click [data-version]': 'onOpenMainPage'
    };
  }

  constructor(core: Core) {
    super(core);
    if (this.options.contextMenu && this.options.contextMenu.label) {
      this._label = this.options.contextMenu.label;
    }
    if (this.options.contextMenu && this.options.contextMenu.url) {
      this._url = this.options.contextMenu.url;
    }
    this.render();
    this.bindEvents();
  }

  override bindEvents() {
    if (this.mediaControl) {
      this.listenTo(this.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.containerChanged);

      if (this.container) {
        this.listenTo(this.container, Events.CONTAINER_CONTEXTMENU, this.toggleContextMenu);
        this.listenTo(this.container, Events.CONTAINER_CLICK, this.hide);
      }
    }
    $('body').on('click', this.hide.bind(this));
  }

  override destroy() {
    $('body').off('click', this.hide.bind(this));
    // @ts-ignore
    this.stopListening();
    return super.destroy();
  }

  private containerChanged() {
    this.container = this.core.activeContainer;
    // @ts-ignore
    this.stopListening();
    this.bindEvents();
  }

  private toggleContextMenu(event: MouseEvent) {
    event.preventDefault();
    const offset = this.container?.$el.offset();

    this.show(event.pageY - offset.top, event.pageX - offset.left);
  }

  private show(top: number, left: number) {
    this.hide();
    if (this.options.contextMenu && this.options.contextMenu.preventShowContextMenu) {
      return;
    }
    this.$el.css({ top, left });
    this.$el.show();
  }

  private hide() {
    this.$el.hide();
  }

  private onOpenMainPage() {
    window.open(this.url, '_blank');
  }

  override render() {
    this.menuOptions = [this.exposeVersion];
    this.$el.html(this.template({ options: this.menuOptions }));
    this.core.$el.append(this.$el);
    this.hide();
    this.disable();

    return this;
  }
}
