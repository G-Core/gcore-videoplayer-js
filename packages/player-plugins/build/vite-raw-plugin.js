// https://github.com/zhangyuang/vite-raw-plugin/blob/master/index.js

/**
 * @param {{ include: RegExp }} options 
 */
export default function viteRawPlugin (options) {
    return {
      name: 'vite-raw-plugin',
      transform (code, id) {
        if (options.include.test(id)) {
          const json = JSON.stringify(code)
          return {
            code: `export default ${json}`
          }
        }
      }
    }
  }