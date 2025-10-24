import { defineConfig } from 'vitest/config'
import viteRawPlugin from './build/vite-raw-plugin'

export default defineConfig({
  build: {
    assetsInlineLimit: 0,
    target: 'es2015',
  },
  plugins: [
    viteRawPlugin({
      include: /\.ejs$/,
    }),
  ],
  test: {
    include: ['src/**/*.(test|spec).[jt]s'],
  },
})
