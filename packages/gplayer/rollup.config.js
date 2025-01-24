// https://github.com/rollup/rollup-starter-lib
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import polyfillNode from 'rollup-plugin-polyfill-node';

export default [
  {
    input: 'lib/index.js',
    plugins: [
      resolve(),
      commonjs(),
      json(),
      polyfillNode(),
    ],
    output: [
      {
        dir: 'dist',
        format: 'es',
        generatedCode: 'es2015',
      }
    ]
  }
];
