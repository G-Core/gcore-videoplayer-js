import type { Tracer } from "./Tracer.js";

import { Logger } from "../Logger.js";

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

// export class LogTracer implements Tracer {
//   private tags: Record<string, TagValue> = {};

//   reportError(e: Error) {
//     logger.error(e, this.tags);
//   }

//   setTag(name: string, value: TagValue) {
//     this.tags[name] = value;
//   }

//   trace(msg: string, data?: Record<string, unknown>) {
//     const fullData = Object.assign({}, this.tags, data);
//     logger.debug(msg, fullData);
//   }
// }