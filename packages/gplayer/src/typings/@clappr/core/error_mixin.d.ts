import '@clappr/core';
// import ErrorMixin from "@clappr/core/src/base/error_mixin/error_mixin";

// export as namespace "@clappr/core";
declare module "@clappr/core" {
    // export ErrorMixin;

    type ErrorOptions = {
        useCodePrefix: boolean;
    }

    declare interface ErrorMixin {
        createError(error: Object, options?: ErrorOptions): Error;
    }
}
