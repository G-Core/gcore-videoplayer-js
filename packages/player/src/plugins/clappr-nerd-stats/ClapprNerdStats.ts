import { UICorePlugin, Events, template, Core, Container } from '@clappr/core';
import { reportError } from '@gcorevideo/utils';
import Mousetrap from 'mousetrap';

import { CLAPPR_VERSION } from '../build.js';
import { ClapprStatsEvents, Metrics as BaseMetrics } from '../clappr-stats/types.js';
import { newMetrics as newBaseMetrics } from '../clappr-stats/utils.js';
import Formatter from './formatter.js';
import {
  clearSpeedTestResults,
  configureSpeedTest,
  drawSpeedTestResults,
  initSpeedTest,
  startSpeedtest,
  stopSpeedtest,
} from './speedtest/index.js';
import { CustomMetrics } from './speedtest/types.js';
import { ZeptoResult } from '../types.js';

import '../../../assets/clappr-nerd-stats/clappr-nerd-stats.scss';
import pluginHtml from '../../../assets/clappr-nerd-stats/clappr-nerd-stats.ejs';
import buttonHtml from '../../../assets/clappr-nerd-stats/button.ejs';
import statsIcon from '../../../assets/icons/new/stats.svg';

const qualityClasses = [
  'speedtest-quality-value-1',
  'speedtest-quality-value-2',
  'speedtest-quality-value-3',
  'speedtest-quality-value-4',
  'speedtest-quality-value-5'
];

const getDownloadQuality = (speedValue: number): number => {
  if (speedValue < 3) {
    return 1;
  } else if (speedValue < 7) {
    return 2;
  } else if (speedValue < 13) {
    return 3;
  } else if (speedValue < 25) {
    return 4;
  } else {
    return 5;
  }
};

const getPingQuality = (pingValue: number): number => {
  if (pingValue < 20) {
    return 5;
  } else if (pingValue < 50) {
    return 4;
  } else if (pingValue < 100) {
    return 3;
  } else if (pingValue < 150) {
    return 2;
  } else {
    return 1;
  }
};

const generateQualityHtml = (quality: number): string => {
  const html = [];
  const qualityClassName = qualityClasses[quality - 1];

  for (let i = 0; i < qualityClasses.length; i++) {
    if (i < quality) {
      html.push(`<div class="speedtest-quality-content-item ${qualityClassName}"></div>`);
    } else {
      html.push('<div class="speedtest-quality-content-item"></div>');
    }
  }

  return html.join('');
};

const drawSummary = (customMetrics: CustomMetrics, vodContainer: ZeptoResult, liveContainer: ZeptoResult) => {
  const { connectionSpeed, ping } = customMetrics;

  if (!connectionSpeed || !ping) {
    return;
  }
  const downloadQuality = getDownloadQuality(connectionSpeed);
  const pingQuality = getPingQuality(ping);
  const liveQuality = Math.min(downloadQuality, pingQuality);
  const vodHtml = generateQualityHtml(downloadQuality);
  const liveHtml = generateQualityHtml(liveQuality);

  vodContainer.html(vodHtml);
  liveContainer.html(liveHtml);
};

type IconPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

type Metrics = BaseMetrics & {
  general: {
    displayResolution?: string;
    volume?: number;
  },
  custom: CustomMetrics & {
    vodQuality?: string;
    liveQuality?: string;
  };
}

// const T = 'plugins.clappr_nerd_stats';

/**
 * @beta
 */
export class ClapprNerdStats extends UICorePlugin {
  private container: Container | null = null;

  private customMetrics: CustomMetrics = {
    connectionSpeed: 0,
    ping: 0,
    jitter: 0,
  }

  private metrics: Metrics = newMetrics();

  private showing = false;

  private shortcut: string[];

  private iconPosition: IconPosition;

  get name() {
    return 'clappr_nerd_stats';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  get template() {
    return template(pluginHtml);
  }

  override get attributes() {
    return {
      'data-clappr-nerd-stats': '',
      'class': 'clappr-nerd-stats'
    };
  }

  override get events() {
    return {
      'click [data-show-stats-button]': 'showOrHide',
      'click [data-close-button]': 'hide',
      'click [data-refresh-button]': 'refreshSpeedTest',
    };
  }

  get statsBoxElem() {
    return '.clappr-nerd-stats[data-clappr-nerd-stats] .stats-box';
  }

  get statsBoxWidthThreshold() {
    return 720;
  }

  get playerWidth() {
    return this.core.$el.width();
  }

  get playerHeight() {
    return this.core.$el.height();
  }

  constructor(core: Core) {
    super(core);
    this.shortcut = core.options.clapprNerdStats?.shortcut ?? ['command+shift+s', 'ctrl+shift+s'];
    this.iconPosition = core.options.clapprNerdStats?.iconPosition ?? 'bottom-right';
    this.customMetrics = {
      connectionSpeed: 0,
      ping: 0,
      jitter: 0,
    };
    configureSpeedTest(core.options.clapprNerdStats?.speedTestServers ?? []);
  }

  override bindEvents() {
    this.listenToOnce(this.core, Events.CORE_READY, this.init);
    this.listenTo(this.core, 'gear:rendered', this.addToBottomGear);
  }

  private init() {
    this.container = this.core.activeContainer;
    const clapprStats = this.container?.getPlugin('clappr_stats');

    if (!clapprStats) {
      reportError({
        message: 'clappr_stats plugin is not available',
      });
      console.error('clappr-stats not available. Please, include it as a plugin of your Clappr instance.\n' +
        'For more info, visit: https://github.com/clappr/clappr-stats.');
      this.disable();
    } else {
      Mousetrap.bind(this.shortcut, () => this.showOrHide());
      this.listenTo(this.core, Events.CORE_RESIZE, this.onPlayerResize);
      // TODO: fix
      this.listenTo(clapprStats, ClapprStatsEvents.REPORT_EVENT, this.updateMetrics);
      clapprStats.setUpdateMetrics(this.updateMetrics.bind(this));
      this.updateMetrics(clapprStats.exportMetrics());
      this.render();
      // this.$el.find('.speed-test-button').on('click', this.onSpeedTestClick.bind(this));
      // this.$el.find('.close-speed-test').on('click', this.closeSpeedTest.bind(this));
      // this.$el.find('.speed-test').hide();
    }
  }

  private showOrHide(event?: MouseEvent) {
    if (this.showing) {
      this.hide(event);
    } else {
      this.show(event);
    }
  }

  private show(event?: MouseEvent) {
    this.core.$el.find(this.statsBoxElem).show();
    this.showing = true;
    if (event) {
      event.stopPropagation();
    }

    this.refreshSpeedTest();
    initSpeedTest(this.customMetrics).then(() => {
      startSpeedtest();
    }).catch(e => {
      reportError(e);
      this.disable();
    })
  }

  private hide(event?: MouseEvent) {
    this.core.$el.find(this.statsBoxElem).hide();
    this.showing = false;
    if (event) {
      event.stopPropagation();
    }

    stopSpeedtest();
  }

  private onPlayerResize() {
    this.setStatsBoxSize();
  }

  private addGeneralMetrics() {
    this.metrics.general = {
      displayResolution: (this.playerWidth + 'x' + this.playerHeight),
      volume: this.container?.volume
    };
  }

  private addCustomMetrics() {
    this.metrics.custom = this.customMetrics;
    const videoQualityNames = ['SD (480p)', 'HD (720p)', 'Full HD (1080p)', '2K (1440p)', '4K (2160p)'];
    const { connectionSpeed, ping } = this.customMetrics;

    if (!connectionSpeed || !ping) {
      const calculatingText = 'Calculating... Please wait.';

      this.metrics.custom.vodQuality = calculatingText;
      this.metrics.custom.liveQuality = calculatingText;

      return;
    }
    const downloadQuality = getDownloadQuality(connectionSpeed);
    const pingQuality = getPingQuality(ping);
    const liveQuality = Math.min(downloadQuality, pingQuality);

    const prefix = 'Optimal for ';

    this.metrics.custom.vodQuality = prefix + videoQualityNames[downloadQuality - 1];
    this.metrics.custom.liveQuality = prefix + videoQualityNames[liveQuality - 1];
  }

  private updateMetrics(metrics: BaseMetrics) {
    Object.assign(this.metrics, metrics);
    this.addGeneralMetrics();
    this.addCustomMetrics();

    const scrollTop = this.core.$el.find(this.statsBoxElem).scrollTop();

    this.$el.html(this.template({
      metrics: Formatter.format(this.metrics),
      iconPosition: this.iconPosition
    }));
    this.setStatsBoxSize();
    drawSpeedTestResults();
    drawSummary(
      this.metrics?.custom,
      this.$el.find('.speedtest-quality-content[data-streaming-type="vod"]'),
      this.$el.find('.speedtest-quality-content[data-streaming-type="live"]')
    );

    this.core.$el.find(this.statsBoxElem).scrollTop(scrollTop);

    if (!this.showing) {
      this.hide();
    }
  }

  private setStatsBoxSize() {
    if (this.playerWidth >= this.statsBoxWidthThreshold) {
      this.$el.find(this.statsBoxElem).addClass('wide');
      this.$el.find(this.statsBoxElem).removeClass('narrow');
    } else {
      this.$el.find(this.statsBoxElem).removeClass('wide');
      this.$el.find(this.statsBoxElem).addClass('narrow');
    }
  }

  override render() {
    this.core.$el.append(this.$el[0]);
    this.hide();

    return this;
  }

  private addToBottomGear() {
    this.core.mediaControl.$el?.find('.gear-options-list [data-nerd]').html(buttonHtml);

    // this.core.$el.append(optionsList);
    const $button = this.core.$el.find('.nerd-button');

    $button.find('.stats-icon').html(statsIcon);

    $button.on('click', () => {
      // $optionsList.remove();
      this.showOrHide();
    });
  }

  private clearCustomMetrics() {
    const clapprStats = this.container?.getPlugin('clappr_stats');

    this.customMetrics.connectionSpeed = 0;
    this.customMetrics.ping = 0;
    this.customMetrics.jitter = 0;

    if (clapprStats) {
      this.updateMetrics(clapprStats.exportMetrics());
    }
  }

  private refreshSpeedTest() {
    stopSpeedtest();
    setTimeout(() => {
      this.clearCustomMetrics();
      clearSpeedTestResults();
      drawSpeedTestResults();
    }, 200);
    setTimeout(() => {
      startSpeedtest();
    }, 800);
  }
}

function newMetrics(): Metrics {
  return {
    ...newBaseMetrics(),
    general: {},
    custom: {
      connectionSpeed: 0,
      ping: 0,
      jitter: 0,
    },
  }
}
