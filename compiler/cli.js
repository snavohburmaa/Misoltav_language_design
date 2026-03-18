#!/usr/bin/env node
/**
 * misolc CLI — compile Misoltav natively (bytecode + ABI) or transpile to Solidity.
 * Usage:
 *   misolc compile <file.miso>           → native compile, writes <name>.json (bytecode + ABI)
 *   misolc compile <file.miso> -o out.json
 *   misolc transpile <file.miso> -o output.sol  → emit Solidity
 *   misolc check <file.miso>             → parse + checks only, report errors
 *   misolc abi <file.miso> [-o out.json] → output ABI JSON only
 *   misolc test [file.miso]              → run tests (transpile and verify)
 *   misolc fmt <file.miso> [-o out.miso] → format .miso file
 *   misolc run <file.miso> [-o out.json] [--execute] [--call <fn>] → native compile; with --execute runs in local EVM
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { compile, transpileToSolidity } from './compile.js';
import { parse } from './parser.js';

const args = process.argv.slice(2);
const cmd = args[0];
const file = args[1];
const outIdx = args.indexOf('-o');
const outFile = outIdx >= 0 ? args[outIdx + 1] : null;
const runExecute = args.includes('--execute');
const callIdx = args.indexOf('--call');
const callFn = callIdx >= 0 ? args[callIdx + 1] : null;

const VERSION = (() => {
  try {
    const p = JSON.parse(readFileSync(resolve(dirname(new URL(import.meta.url).pathname), 'package.json'), 'utf8'));
    return p.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

function printHelp() {
  console.log(`misolc — Misoltav compiler (EVM bytecode + ABI, Solidity transpiler)

Usage: misolc <command> [file] [options]

Commands:
  build     <file.miso> [-o out.json]   Compile to bytecode + ABI (default: <name>.json)
  run       <file.miso> [-o out.json] [--execute] [--call <fn>]  Compile; --execute runs in local EVM
  test      <file.miso>                  Run test blocks (expect fn() == value)
  compile   <file.miso> [-o out.json]   Alias for build
  transpile <file.miso> -o <file.sol>   Emit Solidity
  check     <file.miso>                  Parse and validate only
  abi       <file.miso> [-o out.json]   Output ABI JSON only
  fmt       <file.miso> [-o out.miso]   Format source

Options:
  -o <path>   Output path (required for transpile, optional for build/run/abi/fmt)
  --execute   (run only) Deploy and run in local EVM
  --call <fn> (run only) Call view function after deploy

Examples:
  misolc build examples/Token.miso
  misolc run examples/HelloWorld.miso --execute --call getGreeting
  misolc test examples/SimpleGet.miso

Version: ${VERSION}
`);
}

if (!cmd || cmd === '--help' || cmd === '-h') {
  printHelp();
  process.exit(0);
}
if (cmd === '--version' || cmd === '-v') {
  console.log(VERSION);
  process.exit(0);
}

const validCommands = ['build', 'compile', 'transpile', 'check', 'abi', 'test', 'fmt', 'run'];
if (!validCommands.includes(cmd)) {
  console.error(`misolc: unknown command '${cmd}'`);
  console.error('Run "misolc --help" for usage.');
  process.exit(1);
}

function readSource(path) {
  const inPath = resolve(process.cwd(), path);
  try {
    return { source: readFileSync(inPath, 'utf8'), inPath };
  } catch (e) {
    console.error('Error reading file:', inPath, e.message);
    process.exit(1);
  }
}

// ─── check ──────────────────────────────────────────────────────────────────
if (cmd === 'check') {
  if (!file) {
    console.error('misolc check requires <file.miso>');
    process.exit(1);
  }
  const { source, inPath } = readSource(file);
  try {
    parse(source);
    console.log('Check OK:', inPath);
  } catch (e) {
    console.error('Check failed:', e.message);
    if (e.line) console.error('  at line', e.line);
    process.exit(1);
  }
  process.exit(0);
}

// ─── abi ───────────────────────────────────────────────────────────────────
if (cmd === 'abi') {
  if (!file) {
    console.error('misolc abi requires <file.miso>');
    process.exit(1);
  }
  const { source } = readSource(file);
  try {
    const result = compile(source);
    const abiJson = JSON.stringify(result.abi, null, 2);
    if (outFile) {
      writeFileSync(resolve(process.cwd(), outFile), abiJson, 'utf8');
      console.log('Wrote ABI to', resolve(process.cwd(), outFile));
    } else {
      console.log(abiJson);
    }
  } catch (e) {
    console.error('ABI failed:', e.message);
    process.exit(1);
  }
  process.exit(0);
}

// ─── test ───────────────────────────────────────────────────────────────────
if (cmd === 'test') {
  if (!file) {
    console.error('misolc test requires <file.miso>');
    process.exit(1);
  }
  const { source } = readSource(file);
  try {
    const { runTests } = await import('./run-tests.js');
    const { passed, failed, results } = await runTests(source);
    for (const r of results) {
      if (r.pass) console.log('✔', r.name);
      else console.log('✖', r.name, r.error ? `— ${r.error}` : '');
    }
    if (failed > 0) {
      process.exit(1);
    }
    if (results.length === 0) {
      console.log('No test blocks found. Add: test "name" { expect get() == 42 }');
    }
    process.exit(0);
  } catch (e) {
    console.error('Test failed:', e.message);
    if (e.line) console.error('  at line', e.line);
    process.exit(1);
  }
}

// ─── fmt ────────────────────────────────────────────────────────────────────
if (cmd === 'fmt') {
  if (!file) {
    console.error('misolc fmt requires <file.miso>');
    process.exit(1);
  }
  const { source, inPath } = readSource(file);
  const lines = source.split(/\r?\n/);
  const indentSize = 4;
  let indent = 0;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trimStart();
    const spaces = line.length - trimmed.length;
    if (trimmed === '') {
      out.push('');
      continue;
    }
    const newSpaces = Math.max(0, Math.floor(spaces / indentSize) * indentSize);
    const newLine = ' '.repeat(newSpaces) + trimmed.trimEnd();
    out.push(newLine);
  }
  const formatted = out.join('\n').replace(/\n+$/, '\n');
  const outPath = outFile ? resolve(process.cwd(), outFile) : inPath;
  writeFileSync(outPath, formatted, 'utf8');
  console.log('Formatted:', outPath);
  process.exit(0);
}

// ─── transpile ──────────────────────────────────────────────────────────────
if (cmd === 'transpile') {
  if (!file) {
    console.error('misolc transpile requires <file.miso>');
    process.exit(1);
  }
  if (!outFile || !outFile.endsWith('.sol')) {
    console.error('Transpile requires -o <file.sol>');
    process.exit(1);
  }
  const { source } = readSource(file);
  try {
    const solidity = transpileToSolidity(source);
    writeFileSync(resolve(process.cwd(), outFile), solidity, 'utf8');
    console.log('Wrote', resolve(process.cwd(), outFile));
  } catch (e) {
    console.error('Transpile failed:', e.message);
    process.exit(1);
  }
  process.exit(0);
}

// ─── run (native compile + print output, no Solidity) ─────────────────────────
if (cmd === 'run') {
  if (!file) {
    console.error('misolc run requires <file.miso>');
    process.exit(1);
  }
  const { source } = readSource(file);
  try {
    const result = compile(source);
    const outPath = outFile
      ? resolve(process.cwd(), outFile)
      : resolve(dirname(resolve(process.cwd(), file)), basename(file, '.miso') + '.json');
    const payload = {
      contractName: result.contractName,
      bytecode: result.bytecode,
      runtimeBytecode: result.runtimeBytecode,
      abi: result.abi,
    };
    writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    const byteLen = (result.bytecode.length - 2) / 2;
    const fns = (result.abi || []).filter(e => e.type === 'function').map(e => e.name + '(' + (e.inputs || []).map(i => i.type).join(',') + ')');
    console.log('--- Misoltav native output (no Solidity) ---');
    console.log('Contract:', result.contractName);
    console.log('Bytecode:', byteLen, 'bytes');
    console.log('Functions:', fns.length ? fns.join(', ') : '(none)');
    console.log('ABI + bytecode written to:', outPath);
    if (runExecute) {
      try {
        const { runCompiled } = await import('./run-vm.js');
        const exec = await runCompiled(payload, callFn || null, []);
        console.log('Execute: deployed in VM, runtime size', exec.runtimeSize, 'bytes, deploy gas', exec.deployGasUsed);
        if (exec.callResult !== undefined) {
          console.log('Call', callFn || '(none)', '=>', exec.callResult, '(gas', exec.callGasUsed + ')');
        }
        if (exec.callError) {
          console.error('Call error:', exec.callError);
        }
      } catch (err) {
        console.error('Execute failed:', err.message);
        process.exit(1);
      }
    }
    console.log('---');
  } catch (e) {
    console.error('Run failed:', e.message);
    if (e.line) console.error('  at line', e.line);
    process.exit(1);
  }
  process.exit(0);
}

// ─── build / compile (native) ───────────────────────────────────────────────
if (cmd === 'build' || cmd === 'compile') {
  if (!file) {
    console.error(`misolc ${cmd} requires <file.miso>`);
    process.exit(1);
  }
  const { source } = readSource(file);
  try {
    const result = compile(source);
    const outPath = outFile
      ? resolve(process.cwd(), outFile)
      : resolve(dirname(resolve(process.cwd(), file)), basename(file, '.miso') + '.json');
    const payload = {
      contractName: result.contractName,
      bytecode: result.bytecode,
      runtimeBytecode: result.runtimeBytecode,
      abi: result.abi,
    };
    writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    const byteLen = (result.bytecode.length - 2) / 2;
    console.log(result.contractName + ' compiled to', byteLen, 'bytes →', outPath);
  } catch (e) {
    console.error('Compilation failed:', e.message);
    if (e.line) console.error('  at line', e.line);
    process.exit(1);
  }
  process.exit(0);
}
