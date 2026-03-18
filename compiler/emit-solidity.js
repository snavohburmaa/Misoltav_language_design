/**
 * Emit Solidity from Misoltav AST. Produces .sol that compiles with solc/Foundry.
 */

import { parse } from './parser.js';

function emitExpr(e) {
  if (!e) return '';
  switch (e.kind) {
    case 'Id':
      if (e.name === 'sender') return 'msg.sender';
      if (e.name === 'value') return 'msg.value';
      if (e.name === 'now') return 'block.timestamp';
      if (e.name === 'block') return 'block.number';
      if (e.name === 'self') return 'address(this)';
      return e.name;
    case 'Literal':
      if (e.type === 'string') return JSON.stringify(e.value);
      if (e.type === 'address') return e.value;
      if (e.type === 'bool') return e.value ? 'true' : 'false';
      if (e.type === 'number' && typeof e.value === 'object' && e.value.unit) {
        const n = e.value.number;
        const u = e.value.unit;
        if (u === 'ether') return `${n} ether`;
        if (u === 'wei') return `${n} wei`;
        if (u === 'gwei') return `${n} gwei`;
        if (u === 'days') return `${n} days`;
        if (u === 'hours') return `${n} hours`;
        if (u === 'minutes') return `${n} minutes`;
        if (u === 'seconds') return `${n} seconds`;
      }
      return e.value;
    case 'Binary':
      return `(${emitExpr(e.left)} ${e.op === 'and' ? '&&' : e.op === 'or' ? '||' : e.op} ${emitExpr(e.right)})`;
    case 'Unary':
      return `(${e.op === 'not' ? '!' : e.op}${emitExpr(e.expr)})`;
    case 'Subscript':
      return `${emitExpr(e.obj)}[${emitExpr(e.index)}]`;
    case 'Member':
      return `${emitExpr(e.obj)}.${e.prop}`;
    case 'Call': {
      const fn = emitExpr(e.fn);
      const args = e.args.map(a => a.kind === 'NamedArg' ? emitExpr(a.expr) : emitExpr(a));
      return `${fn}(${args.join(', ')})`;
    }
    case 'NamedArg':
      return emitExpr(e.expr);
    default:
      return '/*?*/';
  }
}

function emitLvalue(lv) {
  if (lv.kind === 'Id') return lv.name;
  if (lv.kind === 'Subscript') {
    const inner = emitLvalue(lv.obj);
    return `${inner}[${emitExpr(lv.index)}]`;
  }
  if (lv.kind === 'Member') return `${emitExpr(lv.obj)}.${lv.prop}`;
  return emitExpr(lv);
}

function emitStructConstructor(call) {
  if (call.kind !== 'Call' || call.fn?.kind !== 'Id') return emitExpr(call);
  const name = call.fn.name;
  const args = (call.args || []).map(a => a.kind === 'NamedArg' ? emitExpr(a.expr) : emitExpr(a));
  return `${name}(${args.join(', ')})`;
}

function emitStmt(stmt, out, indent) {
  if (stmt.kind === 'Require') {
    const msg = stmt.msg ? `, ${JSON.stringify(stmt.msg)}` : '';
    out.push(`${indent}require(${emitExpr(stmt.cond)}${msg});`);
  } else if (stmt.kind === 'Revert') {
    out.push(`${indent}revert(${JSON.stringify(stmt.msg)});`);
  } else if (stmt.kind === 'RevertError') {
    const args = (stmt.args || []).map(a => emitExpr(a)).join(', ');
    out.push(`${indent}revert ${stmt.name}(${args});`);
  } else if (stmt.kind === 'Emit') {
    const args = stmt.args.map(a => emitExpr(a.expr ?? a));
    out.push(`${indent}emit ${stmt.name}(${args.join(', ')});`);
  } else if (stmt.kind === 'Return') {
    out.push(`${indent}return${stmt.expr ? ' ' + emitExpr(stmt.expr) : ''};`);
  } else if (stmt.kind === 'Send') {
    out.push(`${indent}payable(${emitExpr(stmt.to)}).transfer(${emitExpr(stmt.amount)});`);
  } else if (stmt.kind === 'Assign') {
    const rhs = stmt.expr?.kind === 'Call' && stmt.expr.fn?.kind === 'Id'
      ? emitStructConstructor(stmt.expr) : emitExpr(stmt.expr);
    out.push(`${indent}${emitLvalue(stmt.lvalue)} = ${rhs};`);
  } else if (stmt.kind === 'AugAssign') {
    const op = stmt.op === '+=' ? '+' : stmt.op === '-=' ? '-' : stmt.op === '*=' ? '*' : '/';
    out.push(`${indent}${emitLvalue(stmt.lvalue)} = ${emitLvalue(stmt.lvalue)} ${op} ${emitExpr(stmt.expr)};`);
  } else if (stmt.kind === 'If') {
    out.push(`${indent}if (${emitExpr(stmt.cond)}) {`);
    for (const s of stmt.thenBody || []) emitStmt(s, out, indent + '    ');
    for (const elif of stmt.elifs || []) {
      out.push(`${indent}} else if (${emitExpr(elif.cond)}) {`);
      for (const s of elif.body || []) emitStmt(s, out, indent + '    ');
    }
    if (stmt.elseBody && stmt.elseBody.length > 0) {
      out.push(`${indent}} else {`);
      for (const s of stmt.elseBody) emitStmt(s, out, indent + '    ');
    }
    out.push(`${indent}}`);
  } else if (stmt.kind === 'For') {
    out.push(`${indent}for (uint256 ${stmt.id} = 0; ${stmt.id} < (${emitExpr(stmt.iter)}); ${stmt.id}++) {`);
    for (const s of stmt.body || []) emitStmt(s, out, indent + '    ');
    out.push(`${indent}}`);
  } else if (stmt.kind === 'While') {
    out.push(`${indent}while (${emitExpr(stmt.cond)}) {`);
    for (const s of stmt.body || []) emitStmt(s, out, indent + '    ');
    out.push(`${indent}}`);
  } else if (stmt.kind === 'Match') {
    const expr = emitExpr(stmt.expr);
    const arms = stmt.arms || [];
    for (let i = 0; i < arms.length; i++) {
      const arm = arms[i];
      const variant = arm.variant;
      const cond = `${expr} == ${variant}`;
      const prefix = i === 0 ? 'if' : 'else if';
      out.push(`${indent}${prefix} (${cond}) {`);
      for (const s of arm.body || []) emitStmt(s, out, indent + '    ');
      out.push(`${indent}}`);
    }
  }
}

function mappingKeyType(key) {
  if (key === 'number' || key === 'uint') return 'uint256';
  return 'address';
}

function inferStateVarType(sv, c) {
  if (sv.isArray) {
    const structNames = (c?.structs || []).map(st => st.name);
    const singular = sv.name.replace(/s$/, '');
    const cap = singular.charAt(0).toUpperCase() + singular.slice(1);
    if (structNames.includes(cap)) return `${cap}[]`;
    return 'uint256[]';
  }
  if (sv.mappingKeys && sv.mappingKeys.length > 0) {
    const structNames = (c?.structs || []).map(st => st.name);
    const singular = sv.name.replace(/s$/, '');
    const cap = singular.charAt(0).toUpperCase() + singular.slice(1);
    const valueType = structNames.includes(cap) ? cap : 'uint256';
    if (sv.mappingKeys.length === 1) {
      const k = mappingKeyType(sv.mappingKeys[0]);
      return `mapping(${k} => ${valueType})`;
    }
    const k1 = mappingKeyType(sv.mappingKeys[0]);
    const k2 = mappingKeyType(sv.mappingKeys[1]);
    return `mapping(${k1} => mapping(${k2} => ${valueType}))`;
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
    if (sv.init.kind === 'Call' && sv.init.fn?.kind === 'Id' && c?.structs?.some(st => st.name === sv.init.fn.name))
      return sv.init.fn.name;
  }
  return 'uint256';
}

function emitContract(c, withHeader = true) {
  const out = [];
  if (withHeader) {
    out.push('// SPDX-License-Identifier: MIT');
    out.push('pragma solidity ^0.8.0;');
    out.push('');
  }
  const baseStr = (c.bases && c.bases.length > 0) ? ` is ${c.bases.join(', ')}` : '';
  const abstractStr = c.abstract ? 'abstract ' : '';
  out.push(`${abstractStr}contract ${c.name}${baseStr} {`);

  let needsReentrancy = false;
  for (const fn of c.functions || []) {
    if (fn.guards && fn.guards.some(g => g.type === 'lock')) needsReentrancy = true;
  }
  if (needsReentrancy) {
    out.push('    bool private _locked;');
    out.push('    modifier nonReentrant() { require(!_locked, "Reentrant"); _locked = true; _; _locked = false; }');
    out.push('');
  }

  for (const sv of c.stateVars || []) {
    const typ = inferStateVarType(sv, c);
    let initStr = '';
    if (sv.init) {
      if (sv.init.kind === 'Call' && sv.init.fn?.kind === 'Id' && c?.structs?.some(st => st.name === sv.init.fn.name))
        initStr = ` = ${emitStructConstructor(sv.init)}`;
      else
        initStr = ` = ${emitExpr(sv.init)}`;
    }
    out.push(`    ${typ} public ${sv.name}${initStr};`);
  }
  if ((c.stateVars?.length ?? 0) > 0) out.push('');

  // Enum definitions
  for (const en of c.enums || []) {
    const variants = (en.variants || []).join(', ');
    out.push(`    enum ${en.name} { ${variants} }`);
  }
  if ((c.enums?.length ?? 0) > 0) out.push('');

  // Struct definitions (field names only in AST; infer simple types for Solidity)
  const structFieldType = (name) => {
    if (/description|uri|name|symbol|text|message/.test(name)) return 'string memory';
    return 'uint256';
  };
  for (const st of c.structs || []) {
    const fields = (st.fields || []).map(f => `${structFieldType(f)} ${f}`).join('; ');
    out.push(`    struct ${st.name} { ${fields} }`);
  }
  if ((c.structs?.length ?? 0) > 0) out.push('');

  for (const err of c.errors || []) {
    const params = (err.params || []).join(', ');
    out.push(`    error ${err.name}(${params});`);
  }
  if ((c.errors?.length ?? 0) > 0) out.push('');

  const addressEventParams = new Set(['from', 'to', 'owner', 'spender', 'voter', 'backer']);
  for (const ev of c.events || []) {
    const params = (ev.params || []).map(p => {
      const typ = addressEventParams.has(p) ? 'address' : 'uint256';
      return `${typ} ${p}`;
    }).join(', ');
    out.push(`    event ${ev.name}(${params});`);
  }
  if ((c.events?.length ?? 0) > 0) out.push('');

  const onlyModifiers = new Set();
  for (const fn of c.functions || []) {
    for (const g of fn.guards || []) {
      if (g.type === 'only' && g.expr && g.expr.kind === 'Id') onlyModifiers.add(g.expr.name);
    }
  }
  const hasOverride = (fn) => fn.guards && fn.guards.some(g => g.type === 'override');
  for (const mod of onlyModifiers) {
    const cap = mod.charAt(0).toUpperCase() + mod.slice(1);
    if (mod === 'sender') {
      out.push(`    modifier onlySender() { _; }  // any caller`);
    } else {
      out.push(`    modifier only${cap}() { require(msg.sender == ${mod}, "Not authorized"); _; }`);
    }
  }
  if (onlyModifiers.size > 0) out.push('');

  const stateVarTypes = {};
  for (const sv of c.stateVars || []) stateVarTypes[sv.name] = inferStateVarType(sv, c);

  for (const fn of c.functions || []) {
    const mods = [];
    for (const g of fn.guards || []) {
      if (g.type === 'only' && g.expr && g.expr.kind === 'Id') mods.push(`only${g.expr.name.charAt(0).toUpperCase() + g.expr.name.slice(1)}`);
      if (g.type === 'lock') mods.push('nonReentrant');
      if (g.type === 'payable') mods.push('payable');
    }
    const addressParams = new Set(['to', 'from', 'user', 'owner', 'sender', 'addr', 'spender', 'recipient', 'buyer', 'seller', 'admin']);
    const stringParams = new Set(['newGreeting', 'description', 'uri', 'name', 'symbol']);
    const params = (fn.params || []).map(p => {
      let typ = 'uint256';
      if (addressParams.has(p)) typ = 'address';
      else if (stringParams.has(p) || /Greeting|Uri|Description/.test(p)) typ = 'string memory';
      return `${typ} ${p}`;
    }).join(', ');
    let returnsStr = '';
    if (fn.body && fn.body.length === 1 && fn.body[0].kind === 'Return' && fn.body[0].expr) {
      const e = fn.body[0].expr;
      if (e.kind === 'Id' && stateVarTypes[e.name]) {
        const t = stateVarTypes[e.name];
        if (t === 'string') returnsStr = ' view returns (string memory)';
        else if (t === 'uint256') returnsStr = ' view returns (uint256)';
        else if (t === 'address') returnsStr = ' view returns (address)';
        else if (t === 'bool') returnsStr = ' view returns (bool)';
      }
    }
    const modStr = mods.length ? ' ' + mods.join(' ') : '';
    const overrideStr = hasOverride(fn) ? ' override' : '';
    const isConstructor = fn.name === 'constructor';
    const isReceive = fn.name === 'receive';
    const isFallback = fn.name === 'fallback';
    let fnDecl;
    if (isReceive) {
      fnDecl = `    receive() external payable {`;
    } else if (isFallback) {
      fnDecl = `    fallback() external {`;
    } else if (isConstructor) {
      fnDecl = `    constructor(${params}) ${modStr} {`;
    } else {
      fnDecl = `    function ${fn.name}(${params}) public${modStr}${overrideStr}${returnsStr} {`;
    }
    out.push(fnDecl);
    for (const stmt of fn.body || []) {
      emitStmt(stmt, out, '        ');
    }
    out.push('    }');
    out.push('');
  }

  out.push('}');
  return out.join('\n');
}

function emitInterface(iface) {
  const out = [];
  out.push(`interface ${iface.name} {`);
  for (const sig of iface.signatures || []) {
    const params = (sig.params || []).map(p => {
      const name = p.kind === 'NamedArg' ? p.name : 'p';
      const typ = p.kind === 'NamedArg' ? (p.expr?.kind === 'Id' ? p.expr.name : 'uint256') : 'uint256';
      return `${typ} ${name}`;
    }).join(', ');
    out.push(`    function ${sig.name}(${params}) external;`);
  }
  out.push('}');
  return out.join('\n');
}

function emitImport(imp) {
  if (imp.path) return `import "${imp.path}";`;
  return `import "${imp.module}";`;
}

export function compile(source) {
  const ast = parse(source);
  const out = [];
  out.push('// SPDX-License-Identifier: MIT');
  out.push('pragma solidity ^0.8.0;');
  out.push('');
  for (const imp of ast.imports || []) {
    out.push(emitImport(imp));
  }
  if ((ast.imports?.length ?? 0) > 0) out.push('');
  for (const iface of ast.interfaces || []) {
    out.push(emitInterface(iface));
    out.push('');
  }
  if (!ast.contracts || ast.contracts.length === 0) {
    if ((ast.interfaces?.length ?? 0) === 0) throw new Error('No contract or interface found');
  }
  for (const c of ast.contracts || []) {
    out.push(emitContract(c, false));
    out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
