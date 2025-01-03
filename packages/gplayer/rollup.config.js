// https://github.com/rollup/rollup-starter-lib
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
// import scss from 'rollup-plugin-scss';
import sass from 'rollup-plugin-sass';
import { string } from 'rollup-plugin-string';

export default [
  {
    input: 'lib/index.js',
    plugins: [
      sass({
        // fileName: 'index.css',
        output: 'dist/index.css',
        verbose: true,
      }),
      resolve({
        resolveOnly: ["ms"],
      }),
      commonjs(),
      string({
        include: [
          '**/*.ejs',
          '**/*.svg',
        ],
      }),
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
