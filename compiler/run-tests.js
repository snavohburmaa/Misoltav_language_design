/**
 * Run misolc test blocks: compile contract, execute each expect fn() == value, report ✔/✖.
 */

import { parse } from './parser.js';
import { compile } from './emit-evm.js';
import { runCompiled } from './run-vm.js';

function getFunctionName(callExpr) {
  if (!callExpr || callExpr.kind !== 'Call') return null;
  const fn = callExpr.fn;
  if (fn && fn.kind === 'Id') return fn.name;
  if (fn && typeof fn === 'object' && fn.name) return fn.name;
  return null;
}

function getExpectedValue(literalExpr) {
  if (!literalExpr) return undefined;
  if (literalExpr.kind === 'Literal') {
    if (literalExpr.type === 'number') {
      const v = literalExpr.value;
      return typeof v === 'object' && v != null && 'number' in v ? Number(v.number) : Number(v);
    }
    if (literalExpr.type === 'string') return String(literalExpr.value ?? '');
    if (literalExpr.type === 'bool') return literalExpr.value === true;
  }
  return undefined;
}

/** Decode EVM return hex (32-byte uint256) to number. */
function decodeReturnHex(hex) {
  if (!hex || typeof hex !== 'string') return undefined;
  const h = hex.replace(/^0x/, '');
  if (h.length === 0) return 0;
  const padded = h.padStart(64, '0').slice(-64);
  return Number(BigInt('0x' + padded));
}

/** Compare actual (from EVM) with expected (from AST literal) for simple equality. */
function valuesEqual(actualDecoded, expected, op) {
  if (op === '==') return actualDecoded === expected;
  if (op === '!=') return actualDecoded !== expected;
  if (op === '<') return actualDecoded < expected;
  if (op === '>') return actualDecoded > expected;
  if (op === '<=') return actualDecoded <= expected;
  if (op === '>=') return actualDecoded >= expected;
  return false;
}

/**
 * Run all test blocks in source. Returns { passed, failed, results }.
 * @param {string} source - Full .miso file content (contract + test blocks)
 * @returns {{ passed: number, failed: number, results: Array<{ name: string, pass: boolean, expected?: number, actual?: number, error?: string }> }}
 */
export async function runTests(source) {
  const ast = parse(source);
  const tests = ast.tests || [];
  if (tests.length === 0) {
    return { passed: 0, failed: 0, results: [] };
  }

  let compiled;
  try {
    compiled = compile(source);
  } catch (e) {
    return {
      passed: 0,
      failed: tests.length,
      results: tests.map(t => ({ name: t.name, pass: false, error: 'Compile failed: ' + e.message })),
    };
  }

  const results = [];
  for (const test of tests) {
    const fnName = getFunctionName(test.call);
    const expected = getExpectedValue(test.expected);
    if (fnName == null) {
      results.push({ name: test.name, pass: false, error: 'Invalid test: expect must be a function call (e.g. get())' });
      continue;
    }
    if (expected === undefined && test.expected?.kind !== 'Literal') {
      results.push({ name: test.name, pass: false, error: 'Invalid test: expected value must be a literal (e.g. 42)' });
      continue;
    }

    try {
      const exec = await runCompiled(
        {
          bytecode: compiled.bytecode,
          runtimeBytecode: compiled.runtimeBytecode,
          abi: compiled.abi,
        },
        fnName,
        []
      );
      const returnHex = exec.callResult;
      if (exec.callError) {
        results.push({ name: test.name, pass: false, error: String(exec.callError), expected, actual: undefined });
        continue;
      }
      const actualDecoded = decodeReturnHex(returnHex);
      const pass = valuesEqual(actualDecoded, expected, test.op);
      results.push({
        name: test.name,
        pass,
        expected,
        actual: pass ? undefined : actualDecoded,
        error: pass ? undefined : `expected ${test.op} ${expected}, got ${actualDecoded}`,
      });
    } catch (e) {
      results.push({ name: test.name, pass: false, error: e.message, expected });
    }
  }

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  return { passed, failed, results };
}
