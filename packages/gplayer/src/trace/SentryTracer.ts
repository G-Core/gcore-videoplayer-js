import { Client, Scope } from "@sentry/core";

/**
 * @beta
 */
export class SentryTracer {
  constructor(private client: Client, private scope: Scope) {}

  reportError(e: Error) {
    this.client.captureException(e);
  }

  trace(message: string, data?: Record<string, unknown>) {
    this.scope.addBreadcrumb({
      type: "default",
      level: "info",
      message,
      data,
    });
  }
};
