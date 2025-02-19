import { UICorePlugin, Events } from '@clappr/core';

import { CLAPPR_VERSION } from '../../build.js';

export class DisableControls extends UICorePlugin {
  get name() {
    return 'disable_controls';
  }

  get container() {
    return this.core && this.core.activeContainer;
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  override bindEvents() {
    if (this.container) {
      this.listenTo(this.container, Events.CONTAINER_MEDIACONTROL_ENABLE, this.enableControls);
      this.listenTo(this.container, Events.CONTAINER_PLAY, this.enableControls);
      this.listenTo(this.container, Events.CONTAINER_PAUSE, this.enableControls);
      this.listenTo(this.container, Events.CONTAINER_STOP, this.enableControls);
      this.listenTo(this.container, Events.CONTAINER_ENDED, this.enableControls);
      this.listenTo(this.container, 'container:advertisement:start', this.enableControls);
    }
    this.listenTo(this.core, Events.CORE_READY, this.onCoreReady);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_SHOW, this.enableControls);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.enableControls);
  }

  unbindEvents() {
    // @ts-ignore
    this.stopListening(this.core, Events.CORE_READY);
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_SHOW);
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED);
    // @ts-ignore
    this.stopListening(this.container, Events.CONTAINER_MEDIACONTROL_ENABLE);
    // @ts-ignore
    this.stopListening(this.container, Events.CONTAINER_PLAY);
    // @ts-ignore
    this.stopListening(this.container, Events.CONTAINER_PAUSE);
    // @ts-ignore
    this.stopListening(this.container, Events.CONTAINER_STOP);
    // @ts-ignore
    this.stopListening(this.container, Events.CONTAINER_ENDED);
    // @ts-ignore
    this.stopListening(this.container, 'container:advertisement:start');
  }

  private setDisableStyles() {
    const css = document.createElement('style');

    const styles = '.control-need-disable { display: none!important; }';

    css.appendChild(document.createTextNode(styles));

    this.core.$el.get(0).appendChild(css);
  }

  private onCoreReady() {
    this.setDisableStyles();
    this.bindEvents();
    this.enableControls();
  }

  private enableControls() {
    this.disableAllControls();
  }

  private disableAllControls() {
    setTimeout(() => {
      const spinnerPlugin = this.container.getPlugin('spinner');

      spinnerPlugin?.destroy();
      this.container.disableMediaControl();
    }, 0);
  }
}
