import '@clappr/core';

declare module "@clappr/core" {
    // export ErrorMixin;

    type ErrorOptions = {
        useCodePrefix: boolean;
    }

    declare interface ErrorMixin {
        createError(error: Object, options?: ErrorOptions): Error;
    }
}
