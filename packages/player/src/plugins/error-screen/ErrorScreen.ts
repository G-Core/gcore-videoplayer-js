import { UICorePlugin, Events, template, PlayerError } from '@clappr/core';
import { trace } from '@gcorevideo/utils';

import { CLAPPR_VERSION } from '../../build.js';
import type { TimerId, ZeptoResult } from '../../utils/types.js';

import reloadIcon from '../../../assets/icons/old/reload.svg';
import templateHtml from '../../../assets/error-screen/error_screen.ejs';
import '../../../assets/error-screen/error_screen.scss';

const TIME_FOR_UPDATE = 10000;
const MAX_RETRY = 10;

type ErrorObject = {
  description: string;
  details?: string;
  level: string;
  code: string;
  origin: string;
}

type PresentationalError = {
  title: string;
  message: string;
  code: string;
  icon: string;
  reloadIcon: string;
}

const T = 'plugins.error_screen'

export class ErrorScreen extends UICorePlugin {
  private _retry = 0;

  private err: PresentationalError | null = null;

  private hideValue = false;

  private timeout: TimerId | null = null;

  private reloadButton: ZeptoResult | null = null;

  get name() {
    return 'error_gplayer';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  get template() {
    return template(templateHtml);
  }

  get container() {
    return this.core.activeContainer;
  }

  override get attributes() {
    return {
      'class': 'player-error-screen',
      'data-error-screen': '',
    };
  }

  override bindEvents() {
    this.listenTo(this.core, Events.ERROR, this.onError);
    this.listenTo(this.core, Events.CORE_READY, this.onCoreReady);
    this.listenTo(this.core, 'core:advertisement:start', this.onStartAd);
    this.listenTo(this.core, 'core:advertisement:finish', this.onFinishAd);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.onContainerChanged);
  }

  private onCoreReady() {
    trace(`${T} onCoreReady`)
    if (this.core.activePlayback) {
      this.listenTo(this.core.activePlayback, Events.PLAYBACK_PLAY, this.onPlay);
    }
  }

  private onPlay() {
    trace(`${T} onPlay`)
    this.destroyError();
  }

  private destroyError() {
    trace(`${T} destroyError`)
    this._retry = 0;
    this.err = null;
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.$el.hide();
  }

  unBindEvents() {
    // @ts-ignore
    this.stopListening(this.core, 'core:advertisement:start');
    // @ts-ignore
    this.stopListening(this.core, 'core:advertisement:finish');
    // @ts-ignore
    this.stopListening(this.core, Events.ERROR);
  }

  private bindReload() {
    this.reloadButton = this.$el.find('.player-error-screen__reload');
    this.reloadButton && this.reloadButton.on('click', this.reload.bind(this));
  }

  private reload() {
    this._retry++;
    this.core.configure({
      ...this.options, 
        autoPlay: true
    });
    this.core.activeContainer.mediaControlDisabled = false;
    this.unbindReload();
  }

  private unbindReload() {
    this.reloadButton && this.reloadButton.off('click');
  }

  private onContainerChanged() {
    this.err = null;
    if (this.core.getPlugin('error_screen')) {
      this.core.getPlugin('error_screen').disable();
    }
    this.unbindReload();
    this.hide();
  }

  private onStartAd() {
    this.hideValue = true;
    if (this.err) {
      this.hide();
    }
  }

  private onFinishAd() {
    this.hideValue = false;
    if (this.err) {
      this.container.disableMediaControl();
      this.container.stop();
      this.show();
    }
  }

  private onError(err: ErrorObject) {
    trace(`${T} onError`, { err })
    if (
      err.level === PlayerError.Levels.FATAL ||
      err.details === 'bufferStalledError' ||
      err.details === 'manifestParsingError'
    ) {
      this.err = {
        title: this.core.i18n.t('no_broadcast'),
        message: '',
        code: '',
        // icon: (this.err.UI && this.err.UI.icon) || '',
        icon: '',
        reloadIcon,
      };

      if (this.options.errorScreen?.reloadOnError === false) {
        return;
      }

      if (this.options.errorScreen?.neverStopToRetry) {
        this._retry = 0;
      }

      if (this._retry >= MAX_RETRY) {
        this.drying();

        return;
      }

      const ctp = this.container.getPlugin('click_to_pause_custom');

      const toggleCTP = !!ctp?.enabled;
      if (toggleCTP) {
        // clickToPausePlugin.afterEnabled = true;
        ctp.disable();
      }

      this.timeout = setTimeout(() => {
        if (toggleCTP) {
          ctp.enable();
        }
        this.reload();
      }, TIME_FOR_UPDATE);

      const spinnerPlugin = this.container.getPlugin('spinner');
      if (spinnerPlugin) {
        spinnerPlugin.show(); // TODO remove?
        setTimeout(() => spinnerPlugin.show(), 0);
      }
    }
  }

  private drying() {
    const spinnerPlugin = this.container.getPlugin('spinner');

    spinnerPlugin?.hide();

    this._retry = 0;
    if (!this.hideValue) {
      this.container.disableMediaControl();
      this.container.stop();
      this.show();
    }
  }

  show(err?: PresentationalError) {
    if (err) {
      this.err = err;
    }
    // TODO use container.disableMediaControl() instead
    this.core.mediaControl.disable();
    this.render();
    this.$el.show();
  }

  hide() {
    this.$el.hide();
  }

  override render() {
    if (!this.err) {
      return this;
    }
    this.$el.html(this.template(this.err));

    this.core.$el.append(this.el);

    this.bindReload();

    return this;
  }
}
