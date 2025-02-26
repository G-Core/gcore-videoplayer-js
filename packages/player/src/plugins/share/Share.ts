import { Container, Events, UICorePlugin, template } from '@clappr/core';

import { CLAPPR_VERSION } from '../../build.js';

import pluginHtml from '../../../assets/share/share.ejs';
import '../../../assets/share/style.scss';
import shareIcon from '../../../assets/icons/old/share.svg';
import closeIcon from '../../../assets/icons/old/close-share.svg';
import fbIcon from '../../../assets/icons/old/fb.svg';
import twIcon from '../../../assets/icons/old/twitter.svg';

/**
 * `PLUGIN` that adds a share button to the media control UI.
 * @beta
 */
export class Share extends UICorePlugin {
  private hide = false;

  private container: Container | null = null;

  get name() {
    return 'share';
  }

  get supportedVersion() {
    return { min: CLAPPR_VERSION };
  }

  get template() {
    return template(pluginHtml);
  }

  override get attributes() {
    return {
      'class': this.name + '_plugin',
      'data-share': ''
    };
  }

  override get events() {
    return {
      'click [data-share-button]': 'onShareShow',
      'click [data-share-close]': 'onShareHide',
      'click [data-share-fb]': 'onShareFB',
      'click [data-share-tw]': 'onShareTW',
      'click [data-share-link]': 'onShareLinkClick',
      'click [data-share-embed]': 'onShareEmbedClick'
    };
  }

  override bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.onReady);
    // this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.reload);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_RENDERED, this.render);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_HIDE, this.hideShare);
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_SHOW, this.showShare);
  }

  unBindEvents() {
    // @ts-ignore
    this.stopListening(this.core, Events.CORE_READY);
    // @ts-ignore
    // this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED);
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_RENDERED);
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_HIDE);
    // @ts-ignore
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_SHOW);
  }

  canShowShare() {
    this.hide = false;
  }

  private onReady() {
    this.hide = true;
    this.container = this.core.activeContainer;
    if (this.container) {
      this.listenTo(this.container, 'container:settingsupdate', this.canShowShare);
    }
    this.hideShare();
  }

  override render() {
    this.$el.html(this.template({
      'url':this.options.shareURL,
      'embed': this.options.embed,
      'embed_title': this.core.i18n.t('embed_title'),
      'share_title': this.core.i18n.t('share_title'),
      'link_title': this.core.i18n.t('link_title'),
      'social_title': this.core.i18n.t('social_title'),
    }));
    this.core.mediaControl.$el.append(this.el);
    this.$el.find('.share-container').hide();
    this.initializeIcons();

    return this;
  }

  hideShare() {
    this.$el.addClass('share-hide');
  }

  showShare() {
    if (this.hide) {
      return;
    }
    this.$el.removeClass('share-hide');
  }

  initializeIcons() {
    this.$el.find('button.media-control-button[data-share-button]')
      .addClass('gcore-skin-button-color')
      .append(shareIcon);
    this.$el.find('div.share-container-header--close').append(closeIcon);
    this.$el.find('div.share-container-header--socialicon_fb').append(fbIcon);
    this.$el.find('div.share-container-header--socialicon_tw').append(twIcon);
  }

  onShareShow() {
    this.$el.find('.share-container').show();
  }

  onShareHide() {
    this.$el.find('.share-container').hide();
  }

  onShareFB() {
    if (this.options.shareURL) {
      const url = 'https://www.facebook.com/sharer.php?u='+this.options.shareURL;

      window.open(url, '_blank');
    }
  }

  onShareTW() {
    if (this.options.shareURL) {
      const url = 'https://twitter.com/intent/tweet?url='+this.options.shareURL;

      window.open(url, '_blank');
    }
  }

  onShareLinkClick() {
    this.$el.find('.share-container-header--link')[0].setSelectionRange(0, this.options.shareURL.length);
  }

  onShareEmbedClick() {
    this.$el.find('.share-container-header--embed')[0].setSelectionRange(0, this.options.embed.length);
  }
}
