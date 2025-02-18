import { defineConfig } from 'vitest/config'
import viteRawPlugin from './build/vite-raw-plugin'

export default defineConfig({
  build: {
    assetsInlineLimit: 0,
  },
  plugins: [
    viteRawPlugin({
      include: /\.ejs$/,
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.(test|spec).[jt]s'],
  },
})
