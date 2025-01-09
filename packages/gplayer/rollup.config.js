// https://github.com/rollup/rollup-starter-lib
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import sass from 'rollup-plugin-sass';
import { string } from 'rollup-plugin-string';
import polyfillNode from 'rollup-plugin-polyfill-node';

export default [
  {
    input: 'lib/index.js',
    plugins: [
      sass({
        output: 'dist/index.css',
        verbose: true,
      }),
      resolve(),
      commonjs(),
      json(),
      string({
        include: [
          '**/*.ejs',
          '**/*.svg',
        ],
      }),
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
