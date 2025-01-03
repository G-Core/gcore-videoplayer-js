import type { Tracer } from "./types.js";

import { Logger } from "../utils/Logger.js";

/**
 * A tracer that logs to the console
 * @public
 */
export class LogTracer implements Tracer {
  private logger: Logger;

  constructor(ns = "") {
    this.logger = new Logger(ns);
  }

  reportError(e: Error) {
    this.logger.error(e);
  }

  trace(msg: string, data?: Record<string, unknown>) {
    this.logger.debug(msg, data);
  }
}
