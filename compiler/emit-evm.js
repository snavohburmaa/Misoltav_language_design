/**
 * Native Misoltav → EVM bytecode + ABI compiler.
 * Compiles Misoltav AST to deployment bytecode and JSON ABI (no Solidity).
 * Uses only browser-safe APIs (no Node Buffer) so it runs in the playground.
 */

import { keccak256 } from 'ethereum-cryptography/keccak.js';
import { parse } from './parser.js';

// ─── Browser-safe encoding (no Buffer) ────────────────────────────────────
const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
function textToBytes(str) {
  if (textEncoder) return textEncoder.encode(str);
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0xd800 || c >= 0xe000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else { const u = (c & 0x3ff) << 10 | (str.charCodeAt(++i) & 0x3ff); bytes.push(0xf0 | (u >> 18), 0x80 | ((u >> 12) & 0x3f), 0x80 | ((u >> 6) & 0x3f), 0x80 | (u & 0x3f)); }
  }
  return new Uint8Array(bytes);
}
function bytesToHex(bytes) {
  const arr = bytes.length !== undefined && !(bytes instanceof Uint8Array) ? bytes : Array.from(bytes);
  return arr.map(b => (b & 0xff).toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex) {
  const out = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

// ─── Type inference (aligned with emit-solidity) ───────────────────────────
const addressParams = new Set(['to', 'from', 'user', 'owner', 'sender', 'addr', 'spender', 'recipient', 'buyer', 'seller', 'admin']);
const stringParams = new Set(['newGreeting', 'description', 'uri', 'name', 'symbol']);

function mappingKeyType(key) {
  if (key === 'number' || key === 'uint') return 'uint256';
  return 'address';
}

function inferStateVarType(sv) {
  if (sv.isArray) return 'array';
  if (sv.mappingKeys && sv.mappingKeys.length > 0) {
    if (sv.mappingKeys.length === 1) return 'mapping';
    return 'mapping2';
  }
  if (sv.init) {
    if (sv.init.kind === 'Literal') {
      if (sv.init.type === 'string') return 'string';
      if (sv.init.type === 'address') return 'address';
      if (sv.init.type === 'number') return 'uint256';
      if (sv.init.type === 'bool') return 'bool';
    }
    if (sv.init.kind === 'Id') {
      if (sv.init.name === 'sender') return 'address';
      if (sv.init.name === 'self') return 'address';
    }
  }
  return 'uint256';
}

function paramTypeForAbi(name, isReturn) {
  if (addressParams.has(name)) return 'address';
  if (stringParams.has(name) || /Greeting|Uri|Description/.test(name)) return 'string';
  return 'uint256';
}

function abiSignature(fnName, paramTypes, returnType) {
  const params = paramTypes.join(',');
  const ret = returnType ? ` returns (${returnType})` : '';
  return `${fnName}(${params})${ret}`;
}

function selector(signature) {
  const h = keccak256(textToBytes(signature));
  return h.slice(0, 4); // first 4 bytes (Uint8Array)
}

// ─── Bytecode buffer (hex) ─────────────────────────────────────────────────
function createBuf() {
  const bytes = [];
  return {
    pushByte(b) { bytes.push((b >>> 0) & 0xff); },
    pushBytes(bs) { for (const b of bs) this.pushByte(b); },
    pushWord32BigEndian(n) {
      const h = (n >>> 0).toString(16).padStart(64, '0');
      for (let i = 0; i < 32; i++) this.pushByte(parseInt(h.slice(i * 2, i * 2 + 2), 16));
    },
    pushWord32FromBytes(bs) {
      if (bs.length > 32) throw new Error('Word too long');
      for (let i = 0; i < 32 - bs.length; i++) this.pushByte(0);
      this.pushBytes(bs);
    },
    hex() { return '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join(''); },
    length() { return bytes.length; },
    getBytes() { return [...bytes]; },
    patchAt(at, dest) { bytes[at] = (dest >> 8) & 0xff; bytes[at + 1] = dest & 0xff; },
  };
}

// EVM opcodes (single byte)
const OP = {
  STOP: 0x00, ADD: 0x01, MUL: 0x02, SUB: 0x03, DIV: 0x04, MOD: 0x06,
  LT: 0x10, GT: 0x11, SLT: 0x12, SGT: 0x13, EQ: 0x14, ISZERO: 0x15,
  AND: 0x16, OR: 0x17,   NOT: 0x19, SHL: 0x1b, SHR: 0x1c,
  CALLDATALOAD: 0x35, CALLDATASIZE: 0x36, CALLDATACOPY: 0x37,
  CODESIZE: 0x38, CODECOPY: 0x39,
  MLOAD: 0x51, MSTORE: 0x52, MSTORE8: 0x53,
  SLOAD: 0x54, SSTORE: 0x55,
  KECCAK256: 0x20,
  CALLER: 0x33, CALLVALUE: 0x34, ADDRESS: 0x30,
  JUMP: 0x56, JUMPI: 0x57, JUMPDEST: 0x5b, PC: 0x58,
  RETURN: 0xf3, REVERT: 0xfd, INVALID: 0xfe,
  PUSH1: 0x60, PUSH2: 0x61, PUSH32: 0x7f,
  DUP1: 0x80, DUP2: 0x81, DUP3: 0x82, SWAP1: 0x90, SWAP2: 0x91, SWAP3: 0x92,
};

function push1(buf, n) { buf.pushByte(OP.PUSH1); buf.pushByte(n & 0xff); }
function push2(buf, n) { buf.pushByte(OP.PUSH2); buf.pushByte((n >> 8) & 0xff); buf.pushByte(n & 0xff); }
function push32(buf, n) {
  buf.pushByte(OP.PUSH32);
  const h = (BigInt(n) & BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')).toString(16).padStart(64, '0');
  for (let i = 0; i < 32; i++) buf.pushByte(parseInt(h.slice(i * 2, i * 2 + 2), 16));
}

function push32Bytes(buf, bytes) {
  buf.pushByte(OP.PUSH32);
  if (bytes.length > 32) throw new Error('Word too long');
  for (let i = 0; i < 32 - bytes.length; i++) buf.pushByte(0);
  buf.pushBytes(bytes);
}

// ─── Storage layout ────────────────────────────────────────────────────────
function buildStorageLayout(stateVars) {
  const layout = {};
  let slot = 0;
  for (const sv of stateVars || []) {
    const typ = inferStateVarType(sv);
    if (typ === 'mapping' || typ === 'mapping2') {
      layout[sv.name] = { slot, type: typ, mapping: true, keys: sv.mappingKeys };
      slot += 1;
    } else if (typ === 'array') {
      layout[sv.name] = { slot, type: 'array', slots: 2 };
      slot += 2;
    } else if (typ === 'string') {
      layout[sv.name] = { slot, type: 'string', slots: 2 };
      slot += 2;
    } else {
      layout[sv.name] = { slot, type: typ };
      slot += 1;
    }
  }
  return layout;
}

// ─── ABI generation ───────────────────────────────────────────────────────
function buildAbi(contractName, stateVars, functions, events) {
  const abi = [];
  const stateVarTypes = {};
  for (const sv of stateVars || []) stateVarTypes[sv.name] = inferStateVarType(sv);

  for (const ev of events || []) {
    const addressEventParams = new Set(['from', 'to', 'owner', 'spender', 'voter', 'backer']);
    abi.push({
      type: 'event',
      name: ev.name,
      inputs: (ev.params || []).map(p => ({
        name: p,
        type: addressEventParams.has(p) ? 'address' : 'uint256',
        indexed: true,
      })),
    });
  }

  for (const fn of functions || []) {
    if (fn.name === 'receive' || fn.name === 'fallback' || fn.name === 'constructor') continue;
    const paramTypes = (fn.params || []).map(p => paramTypeForAbi(p) === 'string' ? 'string' : paramTypeForAbi(p));
    let returnType = null;
    if (fn.body && fn.body.length === 1 && fn.body[0].kind === 'Return' && fn.body[0].expr) {
      const e = fn.body[0].expr;
      if (e.kind === 'Id' && stateVarTypes[e.name]) returnType = stateVarTypes[e.name] === 'string' ? 'string' : stateVarTypes[e.name];
      if (e.kind === 'Subscript' && e.obj?.kind === 'Id' && stateVarTypes[e.obj.name] === 'mapping') returnType = 'uint256';
    }
    const sig = abiSignature(fn.name, paramTypes, returnType);
    const sel = selector(sig);
    abi.push({
      type: 'function',
      name: fn.name,
      inputs: (fn.params || []).map(p => ({ name: p, type: paramTypeForAbi(p) === 'string' ? 'string' : paramTypeForAbi(p) })),
      outputs: returnType ? [{ type: returnType }] : [],
      stateMutability: (fn.guards || []).some(g => g.type === 'payable') ? 'payable' : 'nonpayable',
      selector: '0x' + bytesToHex(sel),
    });
  }
  return abi;
}

// ─── Runtime bytecode emission ─────────────────────────────────────────────
function emitRuntime(contract, layout, abiEntries) {
  const stateVarTypes = {};
  for (const sv of contract.stateVars || []) stateVarTypes[sv.name] = inferStateVarType(sv);
  // We need to pass stateVarTypes into emitRuntime - add as param and use in getter branch
  const buf = createBuf();
  const fnEntries = abiEntries.filter(e => e.type === 'function');
  const functions = contract.functions || [];
  const stateVars = contract.stateVars || [];
  const revertStub = () => { push1(buf, 0); push1(buf, 0); buf.pushByte(OP.REVERT); };
  const jumpDests = [];
  function emitJumpToFn(i) { const at = buf.length() + 1; push2(buf, 0); jumpDests.push({ at, fnIndex: i }); buf.pushByte(OP.JUMPI); }

  buf.pushByte(OP.CALLDATASIZE);
  push1(buf, 4);
  buf.pushByte(OP.LT);
  const revertJumpAt = buf.length() + 1;
  push2(buf, 0);
  jumpDests.push({ at: revertJumpAt, revert: true });
  buf.pushByte(OP.JUMPI);
  push1(buf, 0);
  buf.pushByte(OP.CALLDATALOAD);
  // selector is high 4 bytes of first word: SHR 224
  push1(buf, 224); // 0xe0
  buf.pushByte(OP.SHR);

  let revertLabel;
  for (let i = 0; i < fnEntries.length; i++) {
    const entry = fnEntries[i];
    if (!entry.name) continue;
    let selNum = null;
    const raw = entry.selector;
    if (typeof raw === 'string' && /^0x[0-9a-fA-F]{8}$/.test(raw.trim())) {
      selNum = parseInt(raw.replace(/^0x/, ''), 16);
    } else if (typeof raw === 'number' && raw >= 0 && raw < 0x100000000) {
      selNum = raw;
    }
    if (selNum == null) {
      const paramTypes = (entry.inputs || []).map(inp => (inp && inp.type) || 'uint256');
      let returnType = entry.outputs?.[0]?.type;
      if (returnType !== 'string' && returnType !== 'uint256' && returnType !== 'address') returnType = null;
      const sig = abiSignature(entry.name, paramTypes, returnType);
      const selBytes = selector(sig);
      const selHex = bytesToHex(selBytes);
      if (!selHex || selHex.length < 8) continue;
      selNum = parseInt(selHex.padStart(8, '0').slice(-8), 16);
    }
    push32(buf, BigInt(selNum));
    buf.pushByte(OP.DUP2);
    buf.pushByte(OP.EQ);
    emitJumpToFn(i);
  }
  buf.pushByte(OP.POP);
  buf.pushByte(OP.JUMPDEST);
  revertLabel = buf.length() - 1;
  revertStub();

  for (const j of jumpDests) {
    if (j.revert) buf.patchAt(j.at, revertLabel);
  }

  function emitMappingSlot(buf, keyCalldataOffset, baseSlot) {
    push1(buf, keyCalldataOffset);
    buf.pushByte(OP.CALLDATALOAD);
    push1(buf, 0);
    buf.pushByte(OP.MSTORE);
    push32(buf, baseSlot);
    push1(buf, 32);
    buf.pushByte(OP.MSTORE);
    push1(buf, 0);
    push1(buf, 64);
    buf.pushByte(OP.KECCAK256);
  }

  // ─── General expression/statement emission (stack-based) ─────────────────
  function emitExpr(ctx, e) {
    if (!e) return;
    const { buf, stateVarSlots, stateVarTypes, contract, fnParams, paramOffset } = ctx;
    switch (e.kind) {
      case 'Literal':
        if (e.type === 'number') {
          const n = typeof e.value === 'object' && e.value?.number != null ? e.value.number : e.value;
          push32(buf, BigInt(n));
        } else if (e.type === 'bool') {
          push1(buf, e.value ? 1 : 0);
        } else if (e.type === 'address') {
          const v = typeof e.value === 'string' ? e.value.replace(/^0x/, '') : '';
          const hex = v.length % 2 ? '0' + v : v;
          const n = BigInt('0x' + hex || '0');
          push32(buf, n);
        } else {
          push32(buf, 0n);
        }
        return;
      case 'Id': {
        if (e.name === 'sender') { buf.pushByte(OP.CALLER); return; }
        if (e.name === 'value') { buf.pushByte(OP.CALLVALUE); return; }
        if (e.name === 'self') { buf.pushByte(OP.ADDRESS); return; }
        const paramIdx = fnParams ? fnParams.indexOf(e.name) : -1;
        if (paramIdx >= 0) {
          push1(buf, paramOffset + paramIdx * 32);
          buf.pushByte(OP.CALLDATALOAD);
          return;
        }
        const info = stateVarSlots[e.name];
        if (info) {
          if (info.slots === 2) {
            push32(buf, 0n);
            return;
          }
          push1(buf, info.base);
          buf.pushByte(OP.SLOAD);
          return;
        }
        push32(buf, 0n);
        return;
      }
      case 'Binary': {
        const opMap = { '+': OP.ADD, '-': OP.SUB, '*': OP.MUL, '/': OP.DIV, '%': OP.MOD,
          '<': OP.LT, '>': OP.GT, '<=': OP.GT, '>=': OP.LT, '==': OP.EQ, '!=': OP.EQ,
          'and': OP.AND, 'or': OP.OR };
        if (e.op === '<=') {
          emitExpr(ctx, e.right);
          emitExpr(ctx, e.left);
          buf.pushByte(OP.GT);
          buf.pushByte(OP.ISZERO);
          return;
        }
        if (e.op === '>=') {
          emitExpr(ctx, e.left);
          emitExpr(ctx, e.right);
          buf.pushByte(OP.LT);
          buf.pushByte(OP.ISZERO);
          return;
        }
        if (e.op === '!=') {
          emitExpr(ctx, e.left);
          emitExpr(ctx, e.right);
          buf.pushByte(OP.EQ);
          buf.pushByte(OP.ISZERO);
          return;
        }
        const op = opMap[e.op];
        if (op) {
          emitExpr(ctx, e.left);
          emitExpr(ctx, e.right);
          buf.pushByte(op);
          return;
        }
        push32(buf, 0n);
        return;
      }
      case 'Unary':
        if (e.op === 'not') {
          emitExpr(ctx, e.expr);
          buf.pushByte(OP.ISZERO);
          return;
        }
        emitExpr(ctx, e.expr);
        return;
      case 'Subscript': {
        const objInfo = stateVarSlots[e.obj?.name];
        if (objInfo && stateVarTypes[e.obj?.name] === 'mapping') {
          emitExpr(ctx, e.index);
          push1(buf, 0);
          buf.pushByte(OP.MSTORE);
          push32(buf, objInfo.base);
          push1(buf, 32);
          buf.pushByte(OP.MSTORE);
          push1(buf, 0);
          push1(buf, 64);
          buf.pushByte(OP.KECCAK256);
          buf.pushByte(OP.SLOAD);
          return;
        }
        push32(buf, 0n);
        return;
      }
      default:
        push32(buf, 0n);
    }
  }

  function emitLvalueStore(ctx, lvalue, valueOnStack) {
    const { buf, stateVarSlots } = ctx;
    if (lvalue.kind === 'Id') {
      const info = stateVarSlots[lvalue.name];
      if (!info || info.slots === 2) return false;
      if (!valueOnStack) emitExpr(ctx, null);
      push1(buf, info.base);
      buf.pushByte(OP.SWAP1);
      buf.pushByte(OP.SSTORE);
      return true;
    }
    if (lvalue.kind === 'Subscript' && lvalue.obj?.kind === 'Id') {
      const info = stateVarSlots[lvalue.obj.name];
      if (!info) return false;
      if (!valueOnStack) emitExpr(ctx, null);
      emitExpr(ctx, lvalue.index);
      push1(buf, 0);
      buf.pushByte(OP.MSTORE);
      push32(buf, info.base);
      push1(buf, 32);
      buf.pushByte(OP.MSTORE);
      push1(buf, 0);
      push1(buf, 64);
      buf.pushByte(OP.KECCAK256);
      buf.pushByte(OP.SWAP1);
      buf.pushByte(OP.SSTORE);
      return true;
    }
    return false;
  }

  function emitStmt(ctx, stmt) {
    const { buf, stateVarSlots, stateVarTypes, contract, fnParams, paramOffset, revertStub } = ctx;
    const forwardJump = () => { const at = buf.length(); push2(buf, 0); buf.pushByte(OP.JUMP); return at; };
    const forwardJumpI = () => { const at = buf.length(); push2(buf, 0); buf.pushByte(OP.JUMPI); return at; };
    const mark = () => buf.length();
    const patch = (at, dest) => buf.patchAt(at, dest);

    if (!stmt) return;
    if (stmt.kind === 'Return') {
      if (stmt.expr) {
        emitExpr(ctx, stmt.expr);
        push1(buf, 0);
        buf.pushByte(OP.MSTORE);
        push1(buf, 32);
        push1(buf, 0);
        buf.pushByte(OP.RETURN);
      } else {
        push1(buf, 0);
        push1(buf, 0);
        buf.pushByte(OP.RETURN);
      }
      return;
    }
    if (stmt.kind === 'Assign') {
      emitExpr(ctx, stmt.expr);
      const ok = emitLvalueStore(ctx, stmt.lvalue, true);
      if (!ok) revertStub();
      return;
    }
    if (stmt.kind === 'If') {
      emitExpr(ctx, stmt.cond);
      buf.pushByte(OP.ISZERO);
      const skipThen = forwardJumpI();
      for (const s of stmt.thenBody || []) emitStmt(ctx, s);
      const skipElse = forwardJump();
      const hereAfterThen = mark();
      patch(skipThen, hereAfterThen);
      let prevSkipPastElif = null;
      for (const elif of stmt.elifs || []) {
        const elifStart = mark();
        if (prevSkipPastElif !== null) patch(prevSkipPastElif, elifStart);
        else patch(skipElse, elifStart);
        emitExpr(ctx, elif.cond);
        buf.pushByte(OP.ISZERO);
        const skipElifBody = forwardJumpI();
        for (const s of elif.body || []) emitStmt(ctx, s);
        prevSkipPastElif = forwardJump();
        patch(skipElifBody, mark());
      }
      const afterElifs = mark();
      if (prevSkipPastElif !== null) patch(prevSkipPastElif, afterElifs);
      else patch(skipElse, afterElifs);
      if (stmt.elseBody && stmt.elseBody.length > 0) {
        for (const s of stmt.elseBody) emitStmt(ctx, s);
      }
      return;
    }
    if (stmt.kind === 'While') {
      const loopStart = mark();
      emitExpr(ctx, stmt.cond);
      buf.pushByte(OP.ISZERO);
      const exitLoop = forwardJumpI();
      for (const s of stmt.body || []) emitStmt(ctx, s);
      push2(buf, loopStart);
      buf.pushByte(OP.JUMP);
      patch(exitLoop, mark());
      return;
    }
    if (stmt.kind === 'For') {
      const iterVal = stmt.iter;
      let count = 0;
      if (iterVal?.kind === 'Literal' && iterVal.type === 'number') count = Number(iterVal.value);
      else if (typeof iterVal === 'number') count = iterVal;
      push1(buf, 0);
      push1(buf, 0);
      buf.pushByte(OP.MSTORE);
      const loopHead = mark();
      push1(buf, 0);
      buf.pushByte(OP.MLOAD);
      push1(buf, count);
      buf.pushByte(OP.LT);
      buf.pushByte(OP.ISZERO);
      const exitLoop = forwardJumpI();
      for (const s of stmt.body || []) emitStmt(ctx, s);
      push1(buf, 0);
      buf.pushByte(OP.MLOAD);
      push1(buf, 1);
      buf.pushByte(OP.ADD);
      push1(buf, 0);
      buf.pushByte(OP.SWAP1);
      buf.pushByte(OP.MSTORE);
      push2(buf, loopHead);
      buf.pushByte(OP.JUMP);
      patch(exitLoop, mark());
      return;
    }
    if (stmt.kind === 'Match') {
      const enums = contract.enums || [];
      const enumWithVariants = enums.find(en => en.variants && Array.isArray(en.variants));
      const variants = enumWithVariants ? enumWithVariants.variants : [];
      emitExpr(ctx, stmt.expr);
      let nextCondAt = forwardJump();
      for (let i = 0; i < (stmt.arms || []).length; i++) {
        const arm = stmt.arms[i];
        const variantIdx = typeof arm.variant === 'string' ? variants.indexOf(arm.variant) : 0;
        const armStart = mark();
        patch(nextCondAt, armStart);
        push32(buf, BigInt(variantIdx));
        buf.pushByte(OP.DUP2);
        buf.pushByte(OP.EQ);
        const skipArm = forwardJumpI();
        for (const s of arm.body || []) emitStmt(ctx, s);
        nextCondAt = forwardJump();
        patch(skipArm, mark());
      }
      patch(nextCondAt, mark());
      buf.pushByte(OP.POP);
      return;
    }
    if (stmt.kind === 'Require') {
      emitExpr(ctx, stmt.cond);
      buf.pushByte(OP.ISZERO);
      const skipRevert = forwardJumpI();
      revertStub();
      patch(skipRevert, mark());
      return;
    }
    if (stmt.kind === 'ExprStmt') {
      emitExpr(ctx, stmt.expr);
      buf.pushByte(OP.POP);
      return;
    }
    revertStub();
  }

  function emitGeneralFunctionBody(fn) {
    const ctx = {
      buf,
      stateVarSlots,
      stateVarTypes,
      contract,
      fnParams: fn.params || [],
      paramOffset: 4,
      revertStub,
    };
    if (fn.guards && fn.guards.length > 0) {
      const g = fn.guards.find(x => x.type === 'only' && x.expr?.kind === 'Id' && x.expr.name === 'sender');
      if (g && fn.params && fn.params.length > 0) {
        buf.pushByte(OP.CALLER);
        push1(buf, 4);
        buf.pushByte(OP.CALLDATALOAD);
        buf.pushByte(OP.EQ);
        buf.pushByte(OP.ISZERO);
        const at = buf.length();
        push2(buf, 0);
        buf.pushByte(OP.JUMPI);
        revertStub();
        buf.patchAt(at, buf.length());
      }
    }
    for (const s of fn.body || []) emitStmt(ctx, s);
    push1(buf, 0);
    push1(buf, 0);
    buf.pushByte(OP.RETURN);
  }

  const fnStarts = [];
  const stateVarSlots = {};
  let slot = 0;
  for (const sv of stateVars) {
    const typ = inferStateVarType(sv);
    if (typ === 'mapping' || typ === 'mapping2') { stateVarSlots[sv.name] = { base: slot }; slot += 1; }
    else if (typ === 'string' || typ === 'array') { stateVarSlots[sv.name] = { base: slot, slots: 2 }; slot += 2; }
    else { stateVarSlots[sv.name] = { base: slot }; slot += 1; }
  }

  for (let i = 0; i < functions.length; i++) {
    buf.pushByte(OP.JUMPDEST);
    fnStarts.push(buf.length() - 1);
    const fn = functions[i];
    const isGetter = fn.body && fn.body.length === 1 && fn.body[0].kind === 'Return' && fn.body[0].expr && fn.body[0].expr.kind === 'Id';
    const getterVar = isGetter ? fn.body[0].expr.name : null;

    const returnSubscript = fn.body && fn.body.length === 1 && fn.body[0].kind === 'Return' && fn.body[0].expr?.kind === 'Subscript';
    const mappingGetterVar = returnSubscript ? fn.body[0].expr.obj?.name : null;
    if (mappingGetterVar && stateVarSlots[mappingGetterVar] && stateVarTypes[mappingGetterVar] === 'mapping') {
      const info = stateVarSlots[mappingGetterVar];
      const paramOffset = 4;
      emitMappingSlot(buf, paramOffset, info.base);
      buf.pushByte(OP.SLOAD);
      push1(buf, 0);
      buf.pushByte(OP.MSTORE);
      push1(buf, 32);
      push1(buf, 0);
      buf.pushByte(OP.RETURN);
    } else if (isGetter && getterVar && stateVarSlots[getterVar]) {
      const info = stateVarSlots[getterVar];
      const typ = stateVarTypes[getterVar];
      if (typ === 'string') {
        push1(buf, info.base + 1);
        buf.pushByte(OP.SLOAD);
        push1(buf, 0x40);
        buf.pushByte(OP.MSTORE);
        push1(buf, info.base);
        buf.pushByte(OP.SLOAD);
        push1(buf, 0x20);
        buf.pushByte(OP.MSTORE);
        push1(buf, 0x20);
        buf.pushByte(OP.MSTORE);
        push1(buf, 96);
        push1(buf, 0);
        buf.pushByte(OP.RETURN);
      } else {
        push1(buf, info.base);
        buf.pushByte(OP.SLOAD);
        push1(buf, 0);
        buf.pushByte(OP.MSTORE);
        push1(buf, 32);
        push1(buf, 0);
        buf.pushByte(OP.RETURN);
      }
    } else {
      const setterStmt = fn.body && fn.body.find(s => s.kind === 'Assign' && s.lvalue);
      const paramOffset = 4;
      const mappingSetLv = setterStmt?.lvalue?.kind === 'Subscript' ? setterStmt.lvalue : null;
      const mappingSetName = mappingSetLv?.obj?.kind === 'Id' ? mappingSetLv.obj.name : null;
      if (mappingSetName && stateVarSlots[mappingSetName] && fn.params && fn.params.length >= 2) {
        const info = stateVarSlots[mappingSetName];
        emitMappingSlot(buf, paramOffset, info.base);
        push1(buf, paramOffset + 32);
        buf.pushByte(OP.CALLDATALOAD);
        buf.pushByte(OP.SSTORE);
        push1(buf, 0);
        push1(buf, 0);
        buf.pushByte(OP.RETURN);
      } else if (setterStmt && setterStmt.lvalue.kind === 'Id' && fn.params && fn.params.length >= 1) {
        const lvName = setterStmt.lvalue.name;
        const info = stateVarSlots[lvName];
        if (info && !info.slots) {
          push1(buf, paramOffset);
          buf.pushByte(OP.CALLDATALOAD);
          push1(buf, info.base);
          buf.pushByte(OP.SSTORE);
          push1(buf, 0);
          push1(buf, 0);
          buf.pushByte(OP.RETURN);
        } else if (info && info.slots === 2) {
          push1(buf, paramOffset);
          buf.pushByte(OP.CALLDATALOAD);
          buf.pushByte(OP.DUP1);
          push1(buf, 32);
          buf.pushByte(OP.ADD);
          buf.pushByte(OP.CALLDATALOAD);
          push1(buf, info.base);
          buf.pushByte(OP.SSTORE);
          push1(buf, paramOffset);
          buf.pushByte(OP.CALLDATALOAD);
          push1(buf, 32);
          buf.pushByte(OP.ADD);
          buf.pushByte(OP.CALLDATALOAD);
          push1(buf, info.base + 1);
          buf.pushByte(OP.SSTORE);
          push1(buf, 0);
          push1(buf, 0);
          buf.pushByte(OP.RETURN);
        }
      }
      emitGeneralFunctionBody(fn);
    }
  }

  for (const j of jumpDests) {
    if (j.revert) continue;
    buf.patchAt(j.at, fnStarts[j.fnIndex]);
  }
  return buf.hex();
}

// ─── Constructor (deployment) bytecode ──────────────────────────────────────
function emitCreationCode(runtimeHex) {
  const runtime = hexToBytes(runtimeHex.slice(2));
  const buf = createBuf();
  // CODECOPY(0, 18, runtime.length) then RETURN(0, runtime.length); prefix length = 18
  const start = 18;
  push2(buf, runtime.length);
  buf.pushByte(OP.DUP1);
  push2(buf, start);
  push1(buf, 0);
  buf.pushByte(OP.CODECOPY);
  push1(buf, 0);
  push2(buf, runtime.length);
  buf.pushByte(OP.RETURN);
  const creation = buf.getBytes();
  const full = [...creation, ...runtime];
  return '0x' + bytesToHex(full);
}

// ─── Initialise storage from AST (constructor logic) ─────────────────────────
// For now we don't run constructor in creation code; we could append constructor
// that runs once and then return runtime. Skipped for minimal MVP; state inits
// would require storing literals at slots (complex for string/mappings).

// ─── Public API ────────────────────────────────────────────────────────────
export function compileToBytecode(source) {
  const ast = parse(source);
  if (!ast.contracts || ast.contracts.length === 0) throw new Error('No contract found');
  const contract = ast.contracts[0];
  const layout = buildStorageLayout(contract.stateVars);
  const abi = buildAbi(contract.name, contract.stateVars, contract.functions, contract.events);
  const runtimeHex = emitRuntime(contract, layout, abi);
  const bytecode = emitCreationCode(runtimeHex);
  return {
    bytecode,
    runtimeBytecode: runtimeHex,
    abi,
    contractName: contract.name,
  };
}

export function compile(source) {
  const out = compileToBytecode(source);
  return {
    bytecode: out.bytecode,
    runtimeBytecode: out.runtimeBytecode,
    abi: out.abi,
    contractName: out.contractName,
  };
}
