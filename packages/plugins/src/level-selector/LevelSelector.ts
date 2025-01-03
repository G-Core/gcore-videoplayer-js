import { Events, template, UICorePlugin, $ } from '@clappr/core';
import { trace } from '@gcorevideo/player';

import { CLAPPR_VERSION } from '../build.js';
import { QualityLevelInfo, ZeptoResult } from '../types.js';

import buttonHtml from '../../assets/level-selector/button.ejs';
import listHtml from '../../assets/level-selector/list.ejs';
import hdIcon from '../../assets/icons/new/hd.svg';
import arrowRightIcon from '../../assets/icons/new/arrow-right.svg';
import arrowLeftIcon from '../../assets/icons/new/arrow-left.svg';
import checkIcon from '../../assets/icons/new/check.svg';
import '../../assets/level-selector/style.scss';


const VERSION = '0.0.1';

const T = 'plugins.level_selector';

type PlaybackLevelInfo = {
  level: {
    bitrate: number;
    width: number;
    height: number;
  };
  id: number;
}

const AUTO = -1;

const NO_LEVEL: PlaybackLevelInfo = {
  level: {
    bitrate: 0,
    width: 0,
    height: 0,
  },
  id: -1,
};

export class LevelSelector extends UICorePlugin {
  private currentLevel: PlaybackLevelInfo | null = null;

  private levels: PlaybackLevelInfo[] = [];

  private levelLabels: string[] = [];

  private removeAuto = false;

  get name() {
    return 'level_selector';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  static get version() {
    return VERSION;
  }

  get attributes() {
    return {
      'class': this.name,
      'data-level-selector': ''
    };
  }

  private currentText = 'Auto';

  private selectedLevelId = -1;

  //   constructor(core) {
  //     super(core);
  //   }

  get events() {
    return {
      'click .gear-sub-menu_btn': 'onLevelSelect',
      'click .gear-option': 'onShowLevelSelectMenu',
      'click .go-back': 'goBack',
    };
  }

  bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.bindPlaybackEvents);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.reload);
    // this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_RENDERED, this.render);
    this.listenTo(this.core, 'gear:rendered', this.render);
    // this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_HIDE, this.hideSelectLevelMenu);
  }

  unBindEvents() {
    this.stopListening(this.core, Events.CORE_READY, this.bindPlaybackEvents);
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.reload);
    // this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_RENDERED);
    this.stopListening(this.core, 'gear:rendered', this.render);
    // this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_HIDE);
  }

  private bindPlaybackEvents() {
    // this.currentLevel = {};
    this.currentLevel = NO_LEVEL;
    this.removeAuto = false;
    const currentPlayback = this.core.activePlayback;

    this.listenTo(currentPlayback, Events.PLAYBACK_LEVELS_AVAILABLE, this.fillLevels);
    this.listenTo(currentPlayback, Events.PLAYBACK_LEVEL_SWITCH_START, this.startLevelSwitch);
    this.listenTo(currentPlayback, Events.PLAYBACK_LEVEL_SWITCH_END, this.stopLevelSwitch);
    this.listenTo(currentPlayback, Events.PLAYBACK_BITRATE, this.updateCurrentLevel);

    this.listenTo(currentPlayback, Events.PLAYBACK_STOP, this.onStop);

    const playbackLevelsAvailableWasTriggered = currentPlayback.levels && currentPlayback.levels.length > 0;

    playbackLevelsAvailableWasTriggered && this.fillLevels(currentPlayback.levels);
  }

  onStop() {
    const currentPlayback = this.core.activePlayback;

    this.listenToOnce(currentPlayback, Events.PLAYBACK_PLAY, () => {
      trace(`${T} PLAYBACK_PLAY`, {
        playbackType: currentPlayback.getPlaybackType(),
      });
      if (currentPlayback.getPlaybackType() === 'live') {
        if (this.selectedLevelId !== -1) {
          currentPlayback.currentLevel = this.findLevelBy(this.selectedLevelId) || NO_LEVEL;
        }
      }
    });
  }

  reload() {
    this.unBindEvents();
    this.bindEvents();
    this.bindPlaybackEvents();
  }

  shouldRender() {
    if (!this.core.activeContainer) {
      return false;
    }

    const currentPlayback = this.core.activePlayback;

    if (!currentPlayback) {
      return false;
    }

    // TODO typeof currentPlayback.currentLevel === 'number' should it be
    const respondsToCurrentLevel = currentPlayback.currentLevel !== undefined;
    // Only care if we have at least 2 to choose from
    const hasLevels = !!(this.levels && this.levels.length > 1);

    return respondsToCurrentLevel && hasLevels;
  }

  render() {
    if (this.shouldRender()) {
      // this.$el.html(this.template({ 'levels': this.levels, 'title': this.getTitle() }));
      const t = template(buttonHtml);

      this.$el.html(t({
        currentText: this.currentText,
        hdIcon,
        arrowRightIcon,
      }));

      this.core.mediaControl.$el?.find('.gear-options-list [data-quality]').html(this.el);

      // this.highlightCurrentLevel();
    }

    if (this.removeAuto) {
      this.core.mediaControl
        .$el
        .find('.gear-options-list [data-quality]')
        .find('[data-level-selector-select="-1"]')
        .parent()
        .remove();
    }

    return this;
  }

  private fillLevels(levels: PlaybackLevelInfo[], initialLevel = AUTO) {
    trace('${T} fillLevels', { levels, initialLevel });
    // Player.player.trigger('levels', levels);
    // this.core.trigger('levels', levels);
    // TODO fire directly on the plugin object
    // Remove quality selector if it's not HLS
    if (initialLevel !== -1) {
      this.removeAuto = true;
    }

    // if (this.selectedLevelId === undefined) { // TODO compare with AUTO?
    //   this.selectedLevelId = initialLevel;
    // }
    this.levels = levels;
    this.configureLevelsLabels();
    this.render();
  }

  configureLevelsLabels() {
    trace('${T} configureLevelsLabels', { options: this.core.options, levels: this.levels });

    const labels = this.core.options.levelSelector?.labels;
    this.levelLabels = [];

    if (labels) {
      for (let i = 0; i < this.levels.length; i++) {
        const level = this.levels[i];
        const ll = level.level.width > level.level.height ? level.level.height : level.level.width;
        const label = labels[ll] || `${ll}p`;
        this.levelLabels.push(label);
      }
    }

    trace('${T} configureLevelsLabels leave', { levelLabels: this.levelLabels });

  }

  private findLevelBy(id: number): PlaybackLevelInfo | undefined {
    return this.levels.find((level) => level.id === id);
  }

  private onLevelSelect(event: MouseEvent) {
    const selectedLevel = (event.currentTarget as HTMLElement)?.dataset?.id;
    trace('${T} onLevelSelect', { selectedLevel });
    this.setIndexLevel(parseInt((event.currentTarget as HTMLElement)?.dataset?.id ?? "-1", 10));
    // this.toggleContextMenu();
    // event.stopPropagation();

    // return false;
  }

  goBack() {
    this.core.trigger('gear:refresh');
  }

  setIndexLevel(index: number) {
    this.selectedLevelId = index;
    if (this.core.activePlayback) {
      this.core.activePlayback.trigger('playback:level:select:start');
    }
    if (this.core.activePlayback.currentLevel.id === this.selectedLevelId) {
      return false;
    }
    this.core.activePlayback.currentLevel = this.selectedLevelId;

    try {
      this.updateText(this.selectedLevelId);
      this.highlightCurrentLevel();
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
    }
  }

  onShowLevelSelectMenu() {
    const t = template(listHtml);

    this.$el.html(t({
      levels: this.levels,
      labels: this.levelLabels,
      arrowLeftIcon,
      checkIcon,
    }));

    this.core.mediaControl.$el?.find('.gear-wrapper').html(this.el);
    this.highlightCurrentLevel();
  }

  allLevelElements() {
    return this.$('ul.gear-sub-menu li') as ZeptoResult;
  }

  levelElement(id = -1) {
    return (this.$(`ul.gear-sub-menu a[data-id="${id}"]`) as ZeptoResult).parent();
  }

  getTitle() {
    return (this.core.options.levelSelector || {}).title;
  }

  startLevelSwitch() {
    // Player.player.trigger('startLevelSwitch');
    this.levelElement(this.selectedLevelId).addClass('changing');
  }

  stopLevelSwitch() {
    if (this.core.activePlayback) {
      this.core.activePlayback.trigger('playback:level:select:end',
        {
          label: this.getLevelLabel(this.selectedLevelId)
        });
    }
    this.levelElement(this.selectedLevelId).removeClass('changing');
    // Player.player.trigger('stopLevelSwitch');
  }

  private updateText(level: number) {
    if (level === undefined || isNaN(level)) {
      return;
    }
    this.currentText = this.getLevelLabel(level);
  }

  private getLevelLabel(id: number): string {
    if (id === -1) {
      return 'Auto';
    }
    const index = this.levels.findIndex((l) => l.id === id);
    if (index < 0) {
      return 'Auto';
    }
    return this.levelLabels[index] || formatLevelLabel(this.levels[index]);
  }

  private updateCurrentLevel(info: QualityLevelInfo) {
    trace('${T} updateCurrentLevel', { info, levels: this.levels });
    const level = this.findLevelBy(info.level);

    this.currentLevel = level ? level : null;
    this.highlightCurrentLevel();
    // Player.player.trigger('updateCurrentLevel', info);
  }

  private highlightCurrentLevel() {
    trace('${T} highlightCurrentLevel', { currentLevel: this.currentLevel, selectedLevelId: this.selectedLevelId });
    this.allLevelElements().removeClass('current');
    this.allLevelElements().find('a').removeClass('gcore-skin-active');

    if (this.currentLevel) {
      const currentLevelElement = this.levelElement(this.selectedLevelId);

      currentLevelElement.addClass('current');
      currentLevelElement.find('a').addClass('gcore-skin-active');
    }

    this.updateText(this.selectedLevelId);
  }
}

function formatLevelLabel(level: PlaybackLevelInfo): string {
  const h = level.level.width > level.level.height ? level.level.height : level.level.width;
  return `${h}p`;
}