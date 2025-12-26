import assert from 'assert'
import XHRURLHandler from './xmlhttprequest.js'

// eslint-disable-next-line max-len
const ERROR_MESSAGE =
  'Current context is not supported by any of the default URLHandlers. Please provide a custom URLHandler'

export default class URLHandler {
  static get(
    url: string,
    options: any,
    cb?: (err: any | null, response?: any) => void,
  ) {
    // Allow skip of the options param
    if (!cb) {
      if (typeof options === 'function') {
        cb = options
      }
      options = {}
    }

    assert(cb, 'URLHandler.get: callback is required')
    if (options.response) {
      // Trick: the VAST response XML document is passed as an option
      const { response } = options

      delete options.response

      return cb(null, response)
    }

    if (options.urlhandler?.supported()) {
      // explicitly supply your own URLHandler object
      return options.urlhandler.get(url, options, cb)
    }
    if (XHRURLHandler.supported()) {
      return XHRURLHandler.get(url, options, cb)
    }

    return cb(new Error(ERROR_MESSAGE))
  }
}
