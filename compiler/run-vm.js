/**
 * Execute compiled Misoltav contract in a local EVM (for misolc run --execute).
 * Uses @ethereumjs/evm to deploy and call contracts.
 */

const GAS_LIMIT = BigInt(10_000_000);

function hexToBytes(hex) {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes) {
  if (!bytes || (typeof bytes.length !== 'number')) return '0x';
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(bytes)) return '0x' + bytes.toString('hex');
  return '0x' + Array.from(bytes).map(b => (b & 0xff).toString(16).padStart(2, '0')).join('');
}

/**
 * Build calldata: first 32-byte word = selector in high 4 bytes (big-endian), then args as 32-byte words.
 * Dispatcher does CALLDATALOAD(0) then DIV by 2^224 to get selector.
 */
function buildCalldata(selectorHex, argsHex = []) {
  const sel = (selectorHex || '0x').replace(/^0x/, '').padStart(8, '0').slice(-8);
  if (argsHex.length === 0) return '0x' + sel;
  let body = sel + '0'.repeat(56);
  for (const a of argsHex) {
    const h = (a || '0x').replace(/^0x/, '');
    body += h.padStart(64, '0').slice(-64);
  }
  return '0x' + body;
}

/**
 * Run creation bytecode and return the deployed runtime bytecode (what RETURN returns).
 */
export async function runCreation(creationHex) {
  const { createEVM } = await import('@ethereumjs/evm');
  const evm = await createEVM();
  const code = hexToBytes(creationHex);
  const res = await evm.runCode({
    code,
    gasLimit: GAS_LIMIT,
  });
  if (res.exceptionError) throw new Error(res.exceptionError.error || 'Creation failed');
  const runtimeHex = bytesToHex(res.returnValue);
  return { runtimeHex, gasUsed: res.executionGasUsed };
}

/**
 * Run contract call: execute runtime bytecode with given calldata.
 */
export async function runCall(runtimeHex, calldataHex) {
  const { createEVM } = await import('@ethereumjs/evm');
  const evm = await createEVM();
  const codeBytes = hexToBytes(runtimeHex);
  const code = new Uint8Array(codeBytes);
  let dataBytes = hexToBytes(calldataHex || '0x');
  let data = new Uint8Array(dataBytes);
  if (data.length < 4 && (calldataHex || '0x').length > 2) {
    const h = (calldataHex || '0x').replace(/^0x/, '');
    data = new Uint8Array(Math.ceil(h.length / 2));
    for (let i = 0; i < data.length; i++) data[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  const debug = typeof process !== 'undefined' && process.env.DEBUG_MISOLC_CALL;
  const trace = typeof process !== 'undefined' && process.env.DEBUG_MISOLC_TRACE;
  if (trace && evm.events) {
    evm.events.on('step', (step) => {
      const stackLen = step.stack && typeof step.stack.length === 'number' ? step.stack.length : 0;
      console.error('PC:', step.pc, 'OP:', step.opcode?.name ?? step.opcode, 'STACK:', stackLen);
    });
  }
  const result = await evm.runCode({
    code,
    data,
    gasLimit: GAS_LIMIT,
  });
  if (debug) {
    console.error('[runCall] result.exceptionError:', result.exceptionError ?? null);
    console.error('[runCall] result.returnValue length:', result.returnValue?.length ?? 0);
    console.error('[runCall] result:', result);
  }
  const returnHex = bytesToHex(result.returnValue);
  const out = { returnValue: returnHex, gasUsed: result.executionGasUsed };
  if (result.exceptionError) out.exceptionError = result.exceptionError.error ?? String(result.exceptionError);
  return out;
}

/**
 * Deploy and optionally call a view function. Uses compiled.runtimeBytecode for calls.
 * @param {object} compiled - { bytecode, runtimeBytecode, abi, contractName }
 * @param {string} [callFn] - optional function name to call (e.g. 'getGreeting')
 * @param {string[]} [callArgs] - optional hex-encoded args (32 bytes each), for now unused for simple getters
 */
export async function runCompiled(compiled, callFn = null, callArgs = []) {
  const runtimeHex = compiled.runtimeBytecode;
  const deploySize = runtimeHex ? (runtimeHex.length - 2) / 2 : 0;
  let deployGasUsed = '0';
  try {
    const { gasUsed } = await runCreation(compiled.bytecode);
    deployGasUsed = String(gasUsed);
  } catch (e) {
    deployGasUsed = '(creation: ' + e.message + ')';
  }
  const out = {
    deployed: true,
    runtimeSize: deploySize,
    deployGasUsed,
  };
  if (callFn && compiled.abi && runtimeHex) {
    const fnAbi = compiled.abi.find(e => e.type === 'function' && e.name === callFn);
    if (fnAbi && fnAbi.selector) {
      const calldata = buildCalldata(fnAbi.selector, callArgs);
      const dataBytes = hexToBytes(calldata);
      if (dataBytes.length < 4) throw new Error(`Calldata too short: ${dataBytes.length} bytes (need at least 4 for selector)`);
      const callRes = await runCall(runtimeHex, calldata);
      out.callResult = callRes.returnValue;
      out.callGasUsed = String(callRes.gasUsed);
      if (callRes.exceptionError) out.callError = callRes.exceptionError;
    }
  }
  return out;
}
