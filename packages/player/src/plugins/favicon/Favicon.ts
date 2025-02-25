import { CorePlugin, Events, $, Core, Container } from '@clappr/core';

import { CLAPPR_VERSION } from '../../build.js';
import { ZeptoResult } from '../../types.js';

import playIcon from '../../../assets/icons/new/play.svg';
import pauseIcon from '../../../assets/icons/new/pause.svg';
import stopIcon from '../../../assets/icons/new/stop.svg';

const FAVICON_COLOR = '#567';
const FAVICON_SELECTOR = 'link[rel="shortcut icon"]';

// const oldIcon = $(FAVICON_SELECTOR);

/**
 * The plugin adds custom favicon to the player's tab.
 * @beta
 */
export class Favicon extends CorePlugin {
  private _container: Container | null = null;

  private oldIcon: ZeptoResult;

  private playIcon: ZeptoResult | null = null;

  private pauseIcon: ZeptoResult | null = null;

  private stopIcon: ZeptoResult | null = null;

  get name() {
    return 'favicon';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  //   get oldIcon() {
  //     return oldIcon;
  //   }

  constructor(core: Core) {
    super(core);
    this.oldIcon = $(FAVICON_SELECTOR);
    if (this.oldIcon.length === 0) {
      this.stopIcon = this.createIcon(stopIcon);
      this.changeIcon(this.stopIcon);
    }
    this.configure();
  }

  configure() {
    if (this.core.options.changeFavicon) {
      if (!this.enabled) {
        // @ts-ignore
        this.stopListening(this.core, Events.CORE_OPTIONS_CHANGE);
        this.enable();
      }
    } else if (this.enabled) {
      this.disable();
      this.listenTo(this.core, Events.CORE_OPTIONS_CHANGE, this.configure);
    }
  }

  override bindEvents() {
    this.listenTo(this.core, Events.CORE_OPTIONS_CHANGE, this.configure);
    this.listenTo(this.core, Events.CORE_ACTIVE_CONTAINER_CHANGED, this.containerChanged);
    this.core.activeContainer && this.containerChanged();
  }

  private containerChanged() {
    // @ts-ignore
    this._container && this.stopListening(this._container);
    this._container = this.core.activeContainer;
    this.listenTo(this._container, Events.CONTAINER_PLAY, this.setPlayIcon);
    this.listenTo(this._container, Events.CONTAINER_PAUSE, this.setPauseIcon);
    this.listenTo(this._container, Events.CONTAINER_STOP, this.resetIcon);
    this.listenTo(this._container, Events.CONTAINER_ENDED, this.resetIcon);
    this.listenTo(this._container, Events.CONTAINER_ERROR, this.resetIcon);
    this.resetIcon();
  }

  override disable() {
    super.disable();
    this.resetIcon();
  }

  override destroy() {
    super.destroy();
    this.resetIcon();
  }

  private createIcon(svg: string) {
    const canvas = $('<canvas/>');

    canvas[0].width = 24;
    canvas[0].height = 24;
    const ctx = canvas[0].getContext('2d');

    ctx.fillStyle = this.core.options.faviconColor || FAVICON_COLOR;
    const d = $(svg).find('path').attr('d');
    const path = new Path2D(d);

    ctx.fill(path);
    const icon = $('<link rel="shortcut icon" type="image/png"/>');

    icon.attr('href', canvas[0].toDataURL('image/png'));

    return icon;
  }

  private setPlayIcon() {
    if (!this.playIcon) {
      this.playIcon = this.createIcon(playIcon);
    }

    this.changeIcon(this.playIcon);
  }

  private setPauseIcon() {
    if (!this.pauseIcon) {
      this.pauseIcon = this.createIcon(pauseIcon);
    }

    this.changeIcon(this.pauseIcon);
  }

  private resetIcon() {
    $(FAVICON_SELECTOR).remove();
    const icon = this.oldIcon.length > 0 ? this.oldIcon : this.stopIcon;

    this.changeIcon(icon);
  }

  private changeIcon(icon: ZeptoResult | null) {
    if (icon) {
      $('link[rel="shortcut icon"]').remove();
      $('head').append(icon);
    }
  }
}
