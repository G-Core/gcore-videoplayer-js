// https://github.com/rollup/rollup-starter-lib
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import polyfillNode from 'rollup-plugin-polyfill-node';
import sass from 'rollup-plugin-sass';
import { string } from 'rollup-plugin-string';

export default [
  {
    input: 'lib/index.core.js',
    plugins: [
      resolve(), // TODO check which aren't inlined in the bundle and put them here
      commonjs(),
      json(),
      polyfillNode(),
    ],
    output: [
      {
        file: 'dist/core.js',
        format: 'es',
        generatedCode: 'es2015',
      }
    ]
  },
  {
    input: 'lib/index.plugins.js',
    plugins: [
      resolve(), // TODO check which aren't inlined in the bundle and put them here
      commonjs(),
      json(),
      polyfillNode(),
      sass({
        output: 'dist/plugins/index.css',
        verbose: true,
      }),
      string({
        include: [
          '**/*.ejs',
          '**/*.html',
          '**/*.svg',
          '**/*.worker.js',
        ],
      }),
    ],
    output: [
      {
        file: 'dist/plugins/index.js',
        format: 'es',
        generatedCode: 'es2015',
      }
    ]
  },
  {
    input: 'lib/index.js',
    plugins: [
      resolve(), // TODO check which aren't inlined in the bundle and put them here
      commonjs(),
      json(),
      polyfillNode(),
      sass({
        output: 'dist/index.css',
        verbose: true,
      }),
      string({
        include: [
          '**/*.ejs',
          '**/*.html',
          '**/*.svg',
          '**/*.worker.js',
        ],
      }),
    ],
    output: [
      {
        file: 'dist/index.js',
        format: 'es',
        generatedCode: 'es2015',
      }
    ]
  },
];
