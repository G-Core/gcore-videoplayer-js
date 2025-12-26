import type { Tracer } from './Tracer.js'

import { Logger } from '../Logger.js'

/**
 * A tracer that logs to the console
 * @public
 */
export class LogTracer implements Tracer {
  private logger: Logger

  constructor(appName = '') {
    this.logger = new Logger(appName)
  }

  reportError(e: Error) {
    this.logger.error(e)
  }

  trace(msg: string, data?: Record<string, unknown>) {
    this.logger.debug(msg, data)
  }
}
