import { $ } from "@clappr/core";

/**
 * {@link https://zeptojs.com/#$() | Zepto query result}
 * @beta
 */
export type ZeptoResult = ReturnType<typeof $>;

/**
 * @internal
 */
export type TimerId = ReturnType<typeof setTimeout>;
