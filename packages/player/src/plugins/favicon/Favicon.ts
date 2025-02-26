import { CorePlugin, Events, $, Core, Container } from '@clappr/core';

import { CLAPPR_VERSION } from '../../build.js';
import { ZeptoResult } from '../../types.js';

import playIcon from '../../../assets/icons/new/play.svg';
import pauseIcon from '../../../assets/icons/new/pause.svg';
import stopIcon from '../../../assets/icons/new/stop.svg';

const FAVICON_COLOR = '#567';
const FAVICON_SELECTOR = 'link[rel="shortcut icon"]';

/**
 * @beta
 */
export interface FaviconPluginSettings {
  /**
   * CSS color of the favicon.
   */
  faviconColor?: string;
}

/**
 * `PLUGIN` that changes the favicon according to the player's state.
 * @beta
 * @remarks
 * There are three states: stopped, playing and paused.
 */
export class Favicon extends CorePlugin {
  private oldIcon: ZeptoResult;

  private playIcon: ZeptoResult | null = null;

  private pauseIcon: ZeptoResult | null = null;

  private stopIcon: ZeptoResult | null = null;

  /**
   * @internal
   */
  get name() {
    return 'favicon';
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
  constructor(core: Core) {
    super(core);
    this.oldIcon = $(FAVICON_SELECTOR);
    if (this.oldIcon.length === 0) {
      this.stopIcon = this.createIcon(stopIcon);
      this.changeIcon(this.stopIcon);
    }
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenTo(this.core, Events.CORE_ACTIVE_CONTAINER_CHANGED, this.containerChanged);
  }

  private containerChanged() {
    this.listenTo(this.core.activeContainer, Events.CONTAINER_PLAY, this.setPlayIcon);
    this.listenTo(this.core.activeContainer, Events.CONTAINER_PAUSE, this.setPauseIcon);
    this.listenTo(this.core.activeContainer, Events.CONTAINER_STOP, this.resetIcon);
    this.listenTo(this.core.activeContainer, Events.CONTAINER_ENDED, this.resetIcon);
    this.listenTo(this.core.activeContainer, Events.CONTAINER_ERROR, this.resetIcon);
    this.resetIcon();
  }

  /**
   * @internal
   */
  override disable() {
    super.disable();
    this.resetIcon();
  }

  /**
   * @internal
   */
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
    const icon = this.oldIcon.length > 0 ? this.oldIcon : this.stopIcon;
    this.changeIcon(icon);
  }

  private changeIcon(icon: ZeptoResult) {
    $('link[rel="shortcut icon"]').remove();
    $('head').append(icon);
  }
}
