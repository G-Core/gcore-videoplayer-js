import { UICorePlugin, template, Events } from '@clappr/core';
import { trace } from '@gcorevideo/utils';

import { CLAPPR_VERSION } from '../../build.js';

import pipIcon from '../../../assets/icons/new/pip.svg';
import buttonHtml from '../../../assets/picture-in-picture/button.ejs';
import '../../../assets/picture-in-picture/style.scss';
import assert from 'assert';

const VERSION = '0.0.1';

const T = `plugins.pip`;

/**
 * `PLUGIN` that enables picture in picture mode.
 * @beta
 * @remarks
 * Depends on:
 *
 * - {@link MediaControl}
 *
 * It renders a button to toggle picture in picture mode in the media control UI.
 */
export class PictureInPicture extends UICorePlugin {
  /**
   * @internal
   */
  get name() {
    return 'pip';
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

  private static buttonTemplate = template(buttonHtml);

  /**
   * @internal
   */
  override get events() {
    return {
      'click button': 'togglePictureInPicture',
    };
  }

  override get attributes() {
    return {
      'class': 'media-control-pip',
    };
  }

  private get videoElement() {
    return this.core.activePlayback.el;
  }

  /**
   * @internal
   */
  override bindEvents() {
    this.listenToOnce(this.core, Events.CORE_READY, () => {
      const mediaControl = this.core.getPlugin('media_control');
      assert(mediaControl, 'media_control plugin is required');
      this.listenTo(mediaControl, Events.MEDIACONTROL_RENDERED, this.render);
    });
  }

  private isPiPSupported() {
    trace(`${T} isPiPSupported`, {
      pictureInPictureEnabled: !!document.pictureInPictureEnabled,
      requestPictureInPicture: !!HTMLVideoElement.prototype.requestPictureInPicture,
    });

    return document.pictureInPictureEnabled && !!HTMLVideoElement.prototype.requestPictureInPicture;
  }

  /**
   * @internal
   */
  override render() {
    if (!this.isPiPSupported()) {
      return this;
    }

    this.$el.html(PictureInPicture.buttonTemplate({ pipIcon }));

    const mediaControl = this.core.getPlugin('media_control');
    if (mediaControl) {
      mediaControl.slot('pip', this.$el);
    }

    return this;
  }

  private togglePictureInPicture() {
    trace(`${T} togglePictureInPicture`);
    if (this.videoElement !== document.pictureInPictureElement) {
      this.requestPictureInPicture();
    } else {
      this.exitPictureInPicture();
    }
  }

  private requestPictureInPicture() {
    trace(`${T} requestPictureInPicture`, {
      videoElement: !!this.videoElement,
    });
    this.videoElement.requestPictureInPicture();
  }

  private exitPictureInPicture() {
    trace(`${T} exitPictureInPicture`);
    document.exitPictureInPicture();
  }
}
