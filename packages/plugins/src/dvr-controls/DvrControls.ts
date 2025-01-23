import { Core, Events, Playback, UICorePlugin, template } from '@clappr/core';

import { CLAPPR_VERSION } from '../build.js';

import dvrHTML from '../../assets/dvr-controls/index.ejs';
import '../../assets/dvr-controls/dvr_controls.scss';

export class DvrControls extends UICorePlugin {
  get template() {
    return template(dvrHTML);
  }

  get name() {
    return 'dvr_controls';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  override get events() {
    return {
      'click .live-button': 'click'
    };
  }

  override get attributes() {
    return {
      'class': 'dvr-controls',
      'data-dvr-controls': ''
    };
  }

  constructor(core: Core) {
    super(core);
    this.settingsUpdate();
  }

  override bindEvents() {
    this.bindCoreEvents();
    this.bindContainerEvents();

    if (this.core.activeContainer) {
      this.listenTo(this.core.activeContainer, Events.CONTAINER_PLAYBACKDVRSTATECHANGED, this.dvrChanged);
    }
  }

  private bindCoreEvents() {
    if (this.core.mediaControl.settings) {
      this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.containerChanged);
      this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_RENDERED, this.settingsUpdate);
      this.listenTo(this.core, Events.CORE_OPTIONS_CHANGE, this.render);
    } else {
      setTimeout(() => this.bindCoreEvents(), 100);
    }
  }

  private bindContainerEvents() {
    if (this.core.activeContainer) {
      this.listenToOnce(this.core.activeContainer, Events.CONTAINER_TIMEUPDATE, this.render);
      this.listenTo(this.core.activeContainer, Events.CONTAINER_PLAYBACKDVRSTATECHANGED, this.dvrChanged);
    }
  }

  private containerChanged() {
    // @ts-ignore
    this.stopListening();
    this.bindEvents();
  }

  private dvrChanged(dvrEnabled: boolean) {
    if (this.core.getPlaybackType() !== Playback.LIVE) {
      return;
    }
    this.settingsUpdate();
    this.core.mediaControl.$el.addClass('live');
    if (dvrEnabled) {
      this.core.mediaControl.$playbackRate.removeClass('playbackrate-enable');
      this.core.mediaControl.$el
        .addClass('dvr')
        .find('.media-control-indicator[data-position], .media-control-indicator[data-duration]')
        .hide();
    } else {
      this.core.mediaControl.$playbackRate.addClass('playbackrate-enable');
      this.core.mediaControl.$el.removeClass('dvr');
    }
  }

  click() {
    const mediaControl = this.core.mediaControl;
    const container = mediaControl.container;

    if (!container.isPlaying()) {
      container.play();
    }

    if (mediaControl.$el.hasClass('dvr')) {
      container.seek(container.getDuration());
    }
  }

  settingsUpdate() {
    // @ts-ignore
    this.stopListening();
    this.core.mediaControl.$el.removeClass('live');
    if (this.shouldRender()) {
      this.render();
      this.$el.click(() => this.click());
    }
    this.bindEvents();
  }

  shouldRender() {
    const useDvrControls = this.core.options.useDvrControls === undefined || !!this.core.options.useDvrControls;

    return useDvrControls && this.core.getPlaybackType() === Playback.LIVE;
  }

  override render() {
    this.$el.html(this.template({
      live: this.core.i18n.t('live'),
      backToLive: this.core.i18n.t('back_to_live')
    }));
    if (this.shouldRender()) {
      this.core.mediaControl.$el.addClass('live');
      this.core.mediaControl.$('.media-control-left-panel[data-media-control]').append(this.$el);
    }

    return this;
  }
}
