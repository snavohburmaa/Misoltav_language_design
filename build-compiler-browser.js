#!/usr/bin/env node
/**
 * Bundle the Misoltav compiler for the browser so the Try it page can run real compile without the Node server.
 * Output: website/compiler-browser.js (IIFE, window.MisoltavCompiler = { compile, parse, lex })
 */
import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(__dirname, 'compiler', 'compile.js')],
  bundle: true,
  format: 'iife',
  globalName: 'MisoltavCompiler',
  platform: 'browser',
  outfile: path.join(__dirname, 'website', 'compiler-browser.js'),
  minify: true,
}).catch(() => process.exit(1));

console.log('Built website/compiler-browser.js');
