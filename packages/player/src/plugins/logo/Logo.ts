import { UIContainerPlugin, Events, template as t, Container } from '@clappr/core';

import { CLAPPR_VERSION } from '../../build.js';
import { calculateSize } from './utils/index.js';
import { ZeptoResult } from '../../utils/types.js';

import logoHTML from '../../../assets/logo/templates/logo.ejs';
import '../../../assets/logo/styles/logo.scss';

type PositionStyleAttr = 'top' | 'bottom' | 'left' | 'right';

type LogoOptions = {
  // TODO check
  width?: number;
  height?: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
};

/**
 * The plugin adds custom logo to the player.
 * @beta
 */
export class Logo extends UIContainerPlugin {
  private hasStartedPlaying = false;

  private $logoContainer: ZeptoResult | null = null;

  get name() {
    return 'logo';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  get template() {
    return t(logoHTML);
  }

  override get attributes() {
    return {
      'class': 'player-logo',
      'data-logo': ''
    };
  }

  private get shouldRender() {
    return !!this.options.logo && !!this.options.logo.path;
  }

  override bindEvents() {
    window.addEventListener('resize', this.setPosition);
    this.listenTo(this.container, Events.CONTAINER_RESIZE, this.setPosition);
    this.listenTo(this.container, Events.CONTAINER_STOP, this.onStop);
    this.listenTo(this.container, Events.CONTAINER_PLAY, this.onPlay);
    this.listenTo(this.container, Events.CONTAINER_LOADEDMETADATA, this.setPosition);
  }

  override stopListening() {
    window.removeEventListener('resize', this.setPosition);
    // @ts-ignore
    return super.stopListening();
  }

  private onPlay() {
    this.hasStartedPlaying = true;
    this.setPosition();
  }

  private onStop() {
    this.hasStartedPlaying = false;
    this.update();
  }

  private update() {
    if (!this.shouldRender) {
      return;
    }

    if (!this.hasStartedPlaying) {
      this.$el.hide();
    } else {
      this.$el.show();
    }
  }

  constructor(container: Container) {
    super(container);
    this.setPosition = this.setPosition.bind(this);
    this.hasStartedPlaying = false;
    if (!this.options.logo) {
      this.disable();

      return;
    }
    this.render();
  }

  override render() {
    if (!this.shouldRender) {
      return this;
    }
    this.$el.html(this.template());

    this.setLogoImgAttrs();
    this.container.$el.append(this.$el.get(0));
    this.update();

    return this;
  }

  private setLogoImgAttrs() {
    const { logo: { path: imgUrl, width = 60, height = 60 } } = this.options;

    this.$logoContainer = this.$el.find('.clappr-logo');
    const $logo = this.$logoContainer.find('.clappr-logo-img');

    $logo.attr({
      'src': `${imgUrl}`,
      'style': `width: ${width}px;height: ${height}px;`
    });
  }

  private setLogoWidth(size: { width: number, height: number }) {
    let { logo: { width = 60, height = 60, objectFit = 'contain' } } = this.options;
    const $logo = this.$logoContainer.find('.clappr-logo-img');

    // TODO size must always be defined
    if (size) {
      const logoWidthTimes = Math.floor(size.width / width);
      const logoHeightTimes = Math.floor(size.height / height);

      if (logoHeightTimes < 4) {
        let maxTimes = logoHeightTimes;

        if (logoWidthTimes < 4) {
          maxTimes = logoWidthTimes < logoHeightTimes ? logoWidthTimes : logoHeightTimes;
        }
        switch (maxTimes) {
          case 0:
          case 1:
            maxTimes = 2;
            break;
          case 2:
            maxTimes = 1.5;
            break;
          case 3:
            maxTimes = 1;
            break;

          default:
            break;
        }
        width /= maxTimes;
        height /= maxTimes;
      } else {
        if (logoWidthTimes < 4) {
          let maxTimes = 1;

          switch (logoWidthTimes) {
            case 0:
            case 1:
              maxTimes = 2;
              break;
            case 2:
              maxTimes = 1.5;
              break;
            case 3:
              maxTimes = 1;
              break;

            default:
              break;
          }
          width /= maxTimes;
          height /= maxTimes;
        }
      }
    }
    $logo.attr({
      'style': `width: ${width}px;height: ${height}px;object-fit: ${objectFit}`
    });
  }

  private setPosition() {
    if (!this.shouldRender) {
      return;
    }
    const $el = this.container.$el;
    const targetRect = $el.get(0).getBoundingClientRect();
    const $video = $el.find('video[data-html5-video]');

    if (!$video.get(0)) {
      return;
    }
    const { videoWidth, videoHeight } = $video.get(0);

    const dimensions = calculateSize({
      dom: {
        width: targetRect.width,
        height: targetRect.height
      },
      media: {
        width: videoWidth,
        height: videoHeight
      }
    });

    const { logo } = this.options;
    const { letterboxing: { vertical, horizontal } } = dimensions;

    if (dimensions.media && dimensions.media.width && dimensions.media.height) {
      this.setLogoWidth({ width: dimensions.media.width, height: dimensions.media.height });
    }

    const el = this.$logoContainer.get(0);

    this.setStyles(logo, ['top', 'bottom'], el, vertical);
    this.setStyles(logo, ['left', 'right'], el, horizontal);

    this.update();
  }

  private setStyles(opts: LogoOptions, props: PositionStyleAttr[], el: HTMLElement, value: number) {
    props.forEach(p => this.setStyle(opts, p, el, value));
  }

  private setStyle(opts: LogoOptions, p: PositionStyleAttr, el: HTMLElement, value: number) {
    if (opts[p]) {
      el.style[p] = `${opts[p] + value}px`;
    }
  }
}
