import '@clappr/core'

declare module '@clappr/core' {
  // export ErrorMixin;

  type ErrorOptions = {
    useCodePrefix: boolean
  }

  declare interface ErrorMixin {
    createError(error: object, options?: ErrorOptions): Error
  }
}
