// import LogManager from '../../utils/LogManager';

import assert from "assert";

export default class XHRURLHandler {
  static xhrCreate(): XMLHttpRequest | false {
    const xhr = new window.XMLHttpRequest();

    if ('withCredentials' in xhr) { // check CORS support
      return xhr;
    }

    return false;
  }

  static supported() {
    return !!this.xhrCreate();
  }

  static get(url: string, options: any, cb: (err: Error | null, response?: any) => void) {
    try {
      const xhr = this.xhrCreate();
      assert(xhr, 'XHRURLHandler: XMLHttpRequest is not supported');

      xhr.open('GET', url);
      xhr.timeout = options.timeout || 0;
      xhr.withCredentials = options.withCredentials || false;
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            return cb(null, xhr.response);
          } else {
            return cb(new Error(`XHRURLHandler: ${xhr.statusText}`));
          }
        }
      };

      return xhr.send();
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
      return cb(new Error('XHRURLHandler: Unexpected error'));
    }
  }
}
