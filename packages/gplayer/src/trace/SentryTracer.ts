import {Client} from "@sentry/types";

/**
 * @beta
 */
export class SentryTracer {
  constructor(private client: Client) {}

  reportError(e: Error) {
    this.client.captureException(e);
  }

  trace(msg: string, data?: Record<string, unknown>) {
    this.client.captureMessage(msg, "info", {
      data,
    });
  }
};
