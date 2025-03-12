import 'vitest'

interface CustomMatchers<R = unknown> {
  toMatchPlaybackRateOption: (expected: string) => R
  toMatchQualityLevelLabel: (expected: string) => R
  toMatchQualityLevelOption: (expected: string) => R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
