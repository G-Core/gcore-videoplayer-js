import { Events, UICorePlugin, template } from '@clappr/core';
import {
  AudioTrackLoadedData,
  AudioTrackSwitchedData,
  AudioTracksUpdatedData,
  Events as HlsEvents,
} from 'hls.js';

import { CLAPPR_VERSION } from '../build.js';

import pluginHtml from '../../../assets/audio-selector/track-selector.ejs';
import '../../../assets/audio-selector/style.scss';
import audioArrow from '../../../assets/icons/old/quality-arrow.svg';
import { ZeptoResult } from '../types';

const VERSION: string = '0.0.1';

// const T = 'plugins.audio_selector';

const AUTO = 0;

type AudioTrackW3C = {
  enabled: boolean;
  id: string;
  kind: string
  label: string;
}

type AudioTrackItem = {
  id: number;
  label: string;
}

type AudioTrackList = {
  length: number;
  addEventListener(type: 'change' | 'addtrack' | 'removetrack', listener: EventListenerOrEventListenerObject): void;
  getTrackById(id: string): AudioTrackW3C | null;
  [Symbol.iterator](): IterableIterator<AudioTrackW3C>;
}

/**
 * @beta
 */
export class AudioSelector extends UICorePlugin {
  private selectedTrackId: number | undefined;

  private currentTrack: AudioTrackItem | null = null;

  private tracks: AudioTrackItem[] = [];

  get name() {
    return 'audio_selector';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  static get version() {
    return VERSION;
  }

  get template() {
    return template(pluginHtml);
  }

  override get attributes() {
    return {
      'class': this.name,
      'data-track-selector': ''
    };
  }

  override get events() {
    return {
      'click [data-track-selector-select]': 'onTrackSelect',
      'click [data-track-selector-button]': 'onShowLevelSelectMenu'
    };
  }

  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.bindPlaybackEvents);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.reload);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_RENDERED, this.render);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_HIDE, this.hideSelectTrackMenu);
  }

  unBindEvents() {
    // @ts-ignore
    this.stopListening(this.core, Events.CORE_READY);
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED);
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_RENDERED);
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_HIDE);
  }

  private bindPlaybackEvents() {
    // this.currentTrack = {};
    // this.removeAuto = false;
    this.selectedTrackId = undefined;
    const currentPlayback = this.core.activePlayback;

    this.listenTo(currentPlayback, Events.PLAYBACK_STOP, this.onStop);
    this.setupAudioTrackListeners();
  }

  private setupAudioTrackListeners() {
    const currentPlayback = this.core.activePlayback;

    // TODO no-crutch:currentPlayback._hls
    if (currentPlayback._hls) {
      // TODO AUDIO_TRACKS_UPDATED
      // currentPlayback._hls.on('hlsAudioTracksUpdated', (e, data) => {
      currentPlayback._hls.on(HlsEvents.AUDIO_TRACKS_UPDATED, (e: HlsEvents.AUDIO_TRACKS_UPDATED, data: AudioTracksUpdatedData) => {
        // let id = -1;
        // for (const audioTrack of data.audioTracks) {
        //   if (audioTrack.default) {
        //     id = audioTrack.id;
        //     this.currentTrack = audioTrack;
        //   }
        // }
        const defaultTrack = data.audioTracks.find((track) => track.default);
        if (defaultTrack) {
          this.currentTrack = {
            id: defaultTrack.id,
            label: defaultTrack.name
          };
        }
        this.fillTracks(data.audioTracks.map(p => ({
          id: p.id,
          label: p.name
        })), defaultTrack?.id);
      });
      currentPlayback._hls.on(HlsEvents.AUDIO_TRACK_SWITCHING, this.startTrackSwitch.bind(this));
      currentPlayback._hls.on(HlsEvents.AUDIO_TRACK_SWITCHED, this.updateCurrentTrack.bind(this));
      currentPlayback._hls.on(HlsEvents.AUDIO_TRACK_LOADED, this.updateCurrentTrack.bind(this));
    } else {
      this.listenToOnce(currentPlayback, Events.PLAYBACK_PLAY, () => {
        const mediaElement = currentPlayback.$el.get(0);
        // const { audioTracks } = currentPlayback.$el.get(0);
        const audioTracks: AudioTrackList = mediaElement.audioTracks;

        if (audioTracks && audioTracks.length) {
          let index = 0;
          const trackItems: AudioTrackItem[] = [];
          for (const audioTrack of audioTracks) {
            if (audioTrack.enabled) {
              const t = {
                id: index,
                label: audioTrack.label,
              };
              this.currentTrack = t;
              trackItems.push(t);
              index++;
            }
          }

          audioTracks.addEventListener('change', () => this.updateCurrentTrackW3C());

          this.fillTracks(trackItems, trackItems[0].id);
        }
      });
    }
  }

  private onStop() { }

  reload() {
    this.unBindEvents();
    this.bindEvents();
    this.bindPlaybackEvents();
  }

  private shouldRender() {
    if (!this.core.activeContainer) {
      return false;
    }

    const currentPlayback = this.core.activePlayback;

    if (!currentPlayback) {
      return false;
    }

    const { audioTracks } = (currentPlayback.activePlayback._hls || currentPlayback.$el.get(0));

    this.tracks = audioTracks;

    // Only care if we have at least 2 to choose from
    return this.tracks && this.tracks.length > 1;
  }

  override render() {
    if (this.shouldRender()) {
      this.$el.html(this.template({ 'tracks': this.tracks, 'title': this.getTitle() }));

      if (
        Object.prototype.hasOwnProperty.call(this.core.mediaControl, '$audioTracksSelector') &&
        this.core.mediaControl.$audioTracksSelector.length > 0
      ) {
        this.core.mediaControl.$audioTracksSelector.append(this.el);
      }

      this.highlightCurrentTrack();
    }

    if (
      Object.prototype.hasOwnProperty.call(this.core.mediaControl, '$audioTracksSelector') &&
      this.core.mediaControl.$audioTracksSelector.find('span.audio-arrow').length > 0
    ) {
      this.core.mediaControl.$audioTracksSelector.find('span.audio-arrow').append(audioArrow);
    }

    return this;
  }

  private fillTracks(tracks: AudioTrackItem[], selected = AUTO) {
    if (this.selectedTrackId === undefined) {
      this.selectedTrackId = selected;
    }
    // this.tracks = levels.audioTracks;
    // for (let i = 0; i < this.tracks.length; i++) {
    //   if (this.tracks[i].name && !this.tracks[i].label) {
    //     this.tracks[i].label = this.tracks[i].name;
    //   }
    // }
    this.tracks = tracks;

    // Player.player.trigger('tracks', this.tracks);
    // this.core.trigger('tracks', this.tracks);
    this.render();
  }

  private findTrackBy(id: number) {
    return this.tracks.find((track) => track.id === id);
  }

  private onTrackSelect(event: MouseEvent) {
    // this.selectedTrackId = parseInt(event.target.dataset.levelSelectorSelect, 10)
    const id = (event.target as HTMLElement)?.dataset?.trackSelectorSelect;
    if (id) {
      this.setIndexTrack(Number(id));
    }
    this.toggleContextMenu();
    event.stopPropagation();
    return false;
  }

  private setIndexTrack(index: number) {
    this.selectedTrackId = index;
    if (this.core.activePlayback._hls) {
      if (this.core.activePlayback._hls.audioTrack.id === this.selectedTrackId) {
        return;
      }
      this.core.activePlayback._hls.audioTrack = this.selectedTrackId;
    } else {
      const { audioTracks } = this.core.activePlayback.$el.get(0);

      for (const track of audioTracks) {
        track.enabled = track.id === this.selectedTrackId;
      }
    }
    this.updateText(this.selectedTrackId);
  }

  onShowLevelSelectMenu() {
    this.toggleContextMenu();
  }

  hideSelectTrackMenu() {
    (this.$('.audio_selector ul') as ZeptoResult).hide();
  }

  toggleContextMenu() {
    (this.$('.audio_selector ul') as ZeptoResult).toggle();
  }

  private buttonElement(): ZeptoResult {
    return this.$('.audio_selector button');
  }

  private buttonElementText(): ZeptoResult {
    return this.$('.audio_selector button .audio-text');
  }

  private trackElement(id?: number): ZeptoResult {
    return (this.$('.audio_selector ul a' + (id !== undefined ? '[data-track-selector-select="' + id + '"]' : '')) as ZeptoResult).parent();
  }

  private getTitle(): string {
    if (!this.tracks) {
      return '';
    }

    const selectedTrackId = this.selectedTrackId || 0;

    const selectedTrack = this.tracks[selectedTrackId];

    return selectedTrack?.label || '';
  }

  startTrackSwitch() {
    this.buttonElement().addClass('changing');
  }

  private updateText(trackId: number | undefined) {
    if (trackId === undefined) {
      return;
    }

    const track = this.findTrackBy(trackId);

    if (track) {
      this.buttonElementText().text(track.label);
    }
  }

  updateCurrentTrack(e: HlsEvents.AUDIO_TRACK_SWITCHED, info: AudioTrackSwitchedData | AudioTrackLoadedData) {
    // if (!info) {
    //   const { audioTracks } = this.core.activePlayback.$el.get(0);

    //   for (const track of audioTracks) {
    //     if (track.enabled) {
    //       info = track;
    //     }
    //   }
    // }
    // if (!info) {
    //   return;
    // }

    // const track = this.findTrackBy(info.id);

    // this.currentTrack = track ? track : null;
    // this.selectedTrackId = track?.id;
    // this.highlightCurrentTrack();
    // this.buttonElement().removeClass('changing');
    this.setCurrentTrack(info.id);
  }

  private updateCurrentTrackW3C() {
    const { audioTracks } = this.core.activePlayback.$el.get(0);
    const index = audioTracks.findIndex((track: AudioTrackW3C) => track.enabled);
    if (index >= 0) {
      this.setCurrentTrack(index)
    }
  }

  private setCurrentTrack(index: number) {
    const track = this.findTrackBy(index);

    this.currentTrack = track ?? null;
    this.selectedTrackId = index;
    this.highlightCurrentTrack();
    this.buttonElement().removeClass('changing');
  }

  highlightCurrentTrack() {
    this.trackElement().removeClass('current');
    this.trackElement().find('a').removeClass('gcore-skin-active');

    if (this.currentTrack) {
      const currentTrackElement = this.trackElement(this.currentTrack.id);

      currentTrackElement.addClass('current');
      currentTrackElement.find('a').addClass('gcore-skin-active');
    }

    this.updateText(this.selectedTrackId);
  }
}
