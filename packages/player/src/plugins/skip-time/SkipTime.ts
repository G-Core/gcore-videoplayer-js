import { UICorePlugin as UICorePluginOriginal, Browser, Playback, Events, template } from '@clappr/core';

import { CLAPPR_VERSION } from '../../build.js';

import pluginHtml from '../../../assets/skip-time/skip-time.ejs';
import '../../../assets/skip-time/style.scss';

type Position = 'mid' | 'left' | 'right';

/**
 * PLUGIN that adds skip controls to the media control UI.
 * @beta
 */
export class SkipTime extends UICorePluginOriginal {
  get name() {
    return 'skip_time';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  get container() {
    return this.core && this.core.activeContainer;
  }

  get template() {
    return template(pluginHtml);
  }

  override get attributes() {
    return {
      'class': this.name + '_plugin',
      'data-skip-time': ''
    };
  }

  private position: Position = 'mid';

  override get events() {
    return {
      'click [data-skip-left]': 'setBack',
      'click [data-skip-mid]': 'setMidClick',
      'click [data-skip-right]': 'setForward',
    };
  }

  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.render);
    if (!this.container) {
      return;
    }
    this.listenTo(this.container, Events.CONTAINER_DBLCLICK, this.handleRewindClicks);
  }

  setBack() {
    this.position = 'left';
  }

  handleRewindClicks() {
    if (this.core.getPlaybackType() === Playback.LIVE && !this.container.isDvrEnabled()) {
      this.toggleFullscreen();

      return;
    }
    if (Browser.isMobile) {
      if (this.position === 'left') {
        const seekPos = this.container.getCurrentTime() - 10;

        if (seekPos < 0) {
          return;
        }
        this.container.seek(seekPos);
      } else if (this.position === 'right') {
        const seekPos = this.container.getCurrentTime() + 30;

        if (seekPos > this.container.getDuration()) {
          return;
        }

        this.container.seek(seekPos);
      } else {
        this.toggleFullscreen();
      }
    }
  }

  setMidClick() {
    this.position = 'mid';
  }

  setForward() {
    this.position = 'right';
  }

  toggleFullscreen() {
    this.trigger(Events.MEDIACONTROL_FULLSCREEN, this.name);
    this.container.fullscreen();
    this.core.toggleFullscreen();
  }

  override render() {
    this.$el.html(template(pluginHtml));

    if (this.core.activeContainer) {
      this.core.activeContainer.$el.append(this.el);
    }

    this.bindEvents();

    return this;
  }
}
