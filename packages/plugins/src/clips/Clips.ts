import { Container, Events, UICorePlugin } from '@clappr/core';
import { TimeProgress } from '@gcorevideo/player';

import { strtimeToMiliseconds } from '../utils.js';
import '../../assets/clips/clips.scss';

type ClipDesc = {
  start: number;
  text: string;
  end: number;
  index: number;
}

type ClipItem = {
  start: number;
  text: string;
}

export class ClipsPlugin extends UICorePlugin {
  private clips: Map<number, ClipDesc> = new Map()

  private duration: number = 0;

  private durationGetting = false;

  private _oldContainer: Container | undefined;

  get name() {
    return 'clips';
  }

  get attributes() {
    return {
      'class': this.name
    };
  }

  bindEvents() {
    this.listenToOnce(this.core, Events.CORE_READY, this._onCoreReady);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this._onMediaControlContainerChanged);
    this.listenTo(this.core, Events.CORE_RESIZE, this.playerResize);
  }

  private _onCoreReady() {
    if (!this.options.clips) {
      this.destroy();

      return;
    }

    this.parseClips();
  }

  unbindEvents() {
    // @ts-ignore
    this.stopListening(this.core, Events.CORE_READY);
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED);
  }

  private _onMediaControlContainerChanged() {
    this._bindContainerEvents();
  }

  private playerResize() {
    this.durationGetting = false;
    if (this.durationGetting) {
      this.makeSvg(this.duration);
    }
  }

  private _bindContainerEvents() {
    if (this._oldContainer) {
      this.stopListening(this._oldContainer, Events.CONTAINER_TIMEUPDATE, this.onTimeUpdate);
    }

    this._oldContainer = this.core.mediaControl.container;
    this.durationGetting = false;
    this.listenTo(this.core.mediaControl.container, Events.CONTAINER_TIMEUPDATE, this.onTimeUpdate);
  }

  private onTimeUpdate(event: TimeProgress) {
    if (!this.durationGetting) {
      this.duration = event.total;
      this.makeSvg(event.total);
      this.durationGetting = true;
    }

    for (const value of this.clips.values()) {
      if (event.current >= value.start && event.current < value.end) {
        this.core.mediaControl.setClipText(value.text);
        break;
      }
    }
  }

  private parseClips() {
    const textArr = this.options.clips.text.split('\n');

    const clipsArr = textArr.map((val: string) => {
      const matchRes = val.match(/(\d+:\d+|:\d+) (.+)/i);

      return matchRes ? {
        start: strtimeToMiliseconds(matchRes[1]),
        text: matchRes[2],
      } : null;
    }).filter((clip: ClipItem | null) => clip !== null);

    clipsArr.sort((a: ClipDesc, b: ClipDesc) => a.start - b.start);

    clipsArr.forEach((clip: ClipDesc, index: number) => {
      this.clips.set(clip.start, {
        index,
        start: clip.start,
        text: clip.text,
        end: clipsArr[index + 1] ? clipsArr[index + 1].start : null,
      });
    });
  }

  getText(time: number) {
    for (const [key, value] of this.clips.entries()) {
      if (time >= value.start && time < value.end) {
        return value.text;
      }
    }
    return '';
  }

  makeSvg(duration: number) {
    let svg = '<svg width="0" height="0">\n' + '<defs>\n' + '<clipPath id="myClip">\n';
    const widthOfSeek = this.core.mediaControl.container.$el.width();
    let finishValue = 0;

    this.clips.forEach(val => {
      let end = val.end;

      if (!end) {
        end = val.end = duration;
      }

      const widthChunk = (end - val.start) * widthOfSeek / duration;

      svg += `<rect x="${finishValue}" y="0" width="${widthChunk - 2}" height="30"/>\n`;
      finishValue += widthChunk;
    });

    svg += `<rect x="${finishValue}" y="0" width="${widthOfSeek - finishValue}" height="30"/>\n`;
    svg += '</clipPath>' + '</defs>' + '</svg>';
    this.core.mediaControl.setSVGMask(svg);
  }
}
