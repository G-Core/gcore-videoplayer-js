import 'vitest'

interface CustomMatchers<R = unknown> {
  toMatchQualityLevelLabel: (expected: string) => R
  toMatchQualityLevelOption: (expected: string) => R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
