import { reportError } from '@gcorevideo/utils';
import assert from 'assert';
import URLHandler from './urlhandler.js';
import MergeVast from './xmlmerge.js';
import { strtimeToMiliseconds } from '../utils.js';

export default class LoaderXML {
  private config: string = '';

  constructor(private url: string) {}

  async startLoad() {
    return new Promise<{ url: string }>((resolve, reject) => {
      if (this._isGoogle(this.url)) {
        resolve({ url: this.url });
      } else {
        this.parse(this.url, null, {}, (response: any, err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(response);
          }
        });
      }
    });
  }

  parse(url: string, parentURLs: string | string[] | null, options: any, cb?: (response: any | null, err: any) => void) {
    // Options param can be skipped
    if (!cb) {
      if (typeof options === 'function') {
        cb = options;
      }
      options = {};
    }

    options.withCredentials = !this._isGoogle(url);
    options.timeout = 2000;

    assert(cb)

    URLHandler.get(url, options, (err: any, xml: any) => {
      if (err) {
        return cb(null, err);
      }

      return this.parseXmlDocument(url, parentURLs, options, xml, cb);
    });
  }

  _isGoogle(url: string) {
    return url.indexOf('g.doubleclick.net') > -1 ||
      url.indexOf('ima3vpaid.appspot') > -1 ||
      url.indexOf('an.facebook.com') > -1;
  }

  parseXmlDocument(url: string, parentURLs: string | string[] | null, options: any, xml: any, cb: (response: any, err?: any) => void) {
    if (xml.indexOf('Wrapper')) {
      xml = xml.replace(/Wrapper/g, 'InLine');
    }

    this.extendXML(xml);
    const vastAdTagUri = this.getWrapperUrl();

    if (vastAdTagUri) {
      this.parse(vastAdTagUri, url, options, cb);
    } else {
      const ext = this.getExtension();
      const skipTime = this.timeSkipOffset();
      const clickUrls = this.clickUrls();
      const url = { config: this.config };

      if (this.config.indexOf('<MediaFile') > -1) {
        cb(Object.assign(url, ext, skipTime, clickUrls));
      } else {
        cb(null, { error: 'nobanner' });
      }
    }
  }

  clickUrls() {
    const clickTrackings = this.getUrls('ClickTracking') || [];
    const clickThrough = this.getUrls('ClickThrough').length > 0 ? this.getUrls('ClickThrough')[0] : '';

    this.removeTag('ClickThrough');

    return { clickTrackings, clickThrough };
  }

  timeSkipOffset() {
    const skipEvents = this.getUrls('Tracking', 'event="skip"');
    const progressEvents = this.getUrls('Tracking', 'event="progress"');
    const linearSkipOffset = this.config.match(/skipoffset="(\d+:\d+:\d+){1}"/);
    let timeOffset = -1;

    if (skipEvents.length > 0) {
      timeOffset = 5;
      this.removeTag('Tracking', 'event="skip"');
    }

    if (progressEvents.length > 0) {
      timeOffset = 5;
      this.removeTag('Tracking', 'event="progress"');
    }

    if (linearSkipOffset && linearSkipOffset.length > 1) {
      timeOffset = strtimeToMiliseconds(linearSkipOffset[1]);
      this.config = this.config.replace(/<Linear skipoffset="(\d+:\d+:\d+)".*?>/g, '<Linear>');
    }

    return { skipEvents, progressEvents, timeOffset };
  }

  getExtension() {
    const extensions = this.getTag('Extensions');

    if (!extensions) {
      return {};
    }
    const xml = this.parseXML(extensions[0]);
    assert(xml, 'xml is null');
    const items = xml.getElementsByTagName('Extension');
    const extObj: { controls?: string; isClickable?: string; } & Record<string, string> = {};

    extObj.controls === '1';

    for (let i = 0; i < items.length; i++) {
      try {
        const eventName = items[i].getAttribute('type');
        let trackingURLTemplate = '';

        if (items[i].children && items[i].children.length > 0) {
          trackingURLTemplate = String(items[i]); // TODO or textContent
        } else {
          trackingURLTemplate = this.getExtensionNode(items[i]);
        }
        if (eventName && trackingURLTemplate) {
          try {
            extObj[eventName] = trackingURLTemplate;
          } catch (error) {
            // LogManager.exception(error);
            reportError(error);
          }
        }
      } catch (error) {
        // LogManager.exception(error);
        reportError(error);
        continue;
      }
    }
    if (!extObj.isClickable) {
      extObj.isClickable = '1';
    }
    //может оно и не надо
    if (extObj.isClickable === '0') {
      this.removeTag('VideoClicks');
    }
    if (extObj.skipTime2) {
      if (extObj.skipTime2.split(':').length === 2) {
        extObj.skipTime2 = '00:' + extObj.skipTime2;
      }
      if (this.config.indexOf('Linear') > -1) {
        this.config = this.config.replace(/<Linear.*?>/g, '<Linear skipoffset="' + extObj.skipTime2 + '">');
      }
    }

    return extObj;
  }

  getExtensionNode(node: Element): string {
    if (!node) {
      return '';
    }
    const result = (node.textContent || (node as any).text || '').trim();

    return result;
  }

  getWrapperUrl() {
    const vastAdTagUri = this.getUrls('VASTAdTagURI')[0];

    this.removeTag('VASTAdTagURI');

    return vastAdTagUri;
  }

  getTag(name: string, attr?: string): string[] | null {
    let tag = '<' + name + '.*?>';

    if (attr) {
      tag = '<' + name + ' ' + attr + '.*?>';
    }
    const matchString = new RegExp(tag + '(.|\n|\r)*?' + '<\\/' + name + '>', 'g');

    return this.config.match(matchString);
  }

  getUrls(tag: string, attr?: string): string[] {
    const matched = this.getTag(tag, attr);
    const res: string[] = [];

    if (matched) {
      for (let i = 0; i < matched.length; i++) {
        if (matched[i].indexOf('<![CDATA[') > -1) {
          const lengthCDATA = 9;

          res.push(matched[i].substring(matched[i].indexOf('<![CDATA[') + lengthCDATA, matched[i].indexOf(']]>')));
        } else {
          if (matched[i].indexOf('https://') > -1) {
            res.push(matched[i].substring(matched[i].indexOf('https://'), matched[i].length - 1));
          }
        }
      }
    }

    return res;
  }

  parseXML(val: string): XMLDocument | null {
    let xmlDoc = null;

    if (document.implementation && (document.implementation as any).createDocument) {
      xmlDoc = (new DOMParser()).parseFromString(val, 'application/xml');
    } else if ('ActiveXObject' in window) {
      xmlDoc = new (window.ActiveXObject as any)('Microsoft.XMLDOM');
      xmlDoc.loadXML(val);
    } else {
      return null;
    }

    return xmlDoc;
  }

  removeTag(name: string, attr?: string) {
    let tag = '<'+name+'.*?>';

    if (attr) {
      tag = '<'+name+' ' + attr + '.*?>';
    }
    const filter = new RegExp(tag + '(.|\n|\r)*?' + '<\\/' + name + '>', 'g');

    this.config = this.config.replace(filter, '');
  }

  extendXML(xml: string) {
    if (xml.indexOf('<?xml') < 0) {
      xml = '<?xml version="1.0" encoding="utf-8"?>' + xml;
    }
    if (!this.config) {
      this.config = xml;

      return;
    } else {
      const xmlMerge = new MergeVast(this.config, xml);

      this.config = xmlMerge.merge();
      this.config = this.config.replace(/<\?xml.+\?>/g, '');
    }
  }
}
