import { Logger } from "../utils/Logger.js";

const logger = new Logger("_");

type TagValue = string | boolean | number | null | undefined;

export interface Tracer {
  reportError(e: unknown): void;
  trace(msg: string, data: Record<string, unknown>): void;
}

export class LogTracer implements Tracer {
  private tags: Record<string, TagValue> = {};

  reportError(e: Error) {
    logger.error(e, this.tags);
  }

  setTag(name: string, value: TagValue) {
    this.tags[name] = value;
  }

  trace(msg: string, data?: Record<string, unknown>) {
    const fullData = Object.assign({}, this.tags, data);
    logger.debug(msg, fullData);
  }
}
