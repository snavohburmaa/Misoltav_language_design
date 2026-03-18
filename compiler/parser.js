/**
 * Misoltav parser — recursive descent from BNF. Builds AST for a single contract.
 */

import { lex, TokenType } from './lexer.js';

let tokens = [];
let pos = 0;

function peek() { return tokens[pos] ?? tokens[tokens.length - 1]; }
function advance() { if (pos < tokens.length) pos++; return peek(); }
function is(type, val) {
  const t = peek();
  return t && (val === undefined ? t.type === type : t.type === type && t.value === val);
}
function expect(type, val) {
  const t = peek();
  if (!t || (val !== undefined && t.value !== val) || t.type !== type) {
    const v = val ?? type;
    throw new Error(`Expected ${v} at line ${t?.line ?? '?'}`);
  }
  advance();
  return t;
}
function skipNewlines() {
  while (is(TokenType.Newline)) advance();
}

// ─── AST ───────────────────────────────────────────────────────────────────
export const AST = {
  program(contracts, interfaces, imports, tests) {
    return { kind: 'Program', contracts: contracts ?? [], interfaces: interfaces ?? [], imports: imports ?? [], tests: tests ?? [] };
  },
  test(name, call, op, expected) {
    return { kind: 'Test', name, call, op, expected };
  },
  contract(name, body, bases, abstract) {
    return { kind: 'Contract', name, bases: bases ?? [], abstract: abstract ?? false, ...body };
  },
  stateVar(name, init, mappingKeys, isArray) {
    return { kind: 'StateVar', name, init: init ?? null, mappingKeys: mappingKeys ?? [], isArray: isArray ?? false };
  },
  event(name, params) { return { kind: 'Event', name, params }; },
  struct(name, fields) { return { kind: 'Struct', name, fields }; },
  enum(name, variants) { return { kind: 'Enum', name, variants }; },
  ifStmt(cond, thenBody, elifs, elseBody) { return { kind: 'If', cond, thenBody, elifs: elifs ?? [], elseBody: elseBody ?? null }; },
  match(expr, arms) { return { kind: 'Match', expr, arms }; },
  matchArm(variant, body) { return { kind: 'MatchArm', variant, body }; },
  forStmt(id, iter, body) { return { kind: 'For', id, iter, body }; },
  whileStmt(cond, body) { return { kind: 'While', cond, body }; },
  interface(name, signatures) { return { kind: 'Interface', name, signatures }; },
  fnSignature(name, params) { return { kind: 'FnSignature', name, params }; },
  importStmt(module, path) { return { kind: 'Import', module, path: path ?? null }; },
  fn(name, params, guards, body) { return { kind: 'Function', name, params, guards, body }; },
  guardOnly(expr) { return { kind: 'Guard', type: 'only', expr }; },
  guardLock() { return { kind: 'Guard', type: 'lock' }; },
  guardPayable() { return { kind: 'Guard', type: 'payable' }; },
  guardOverride() { return { kind: 'Guard', type: 'override' }; },
  error(name, params) { return { kind: 'Error', name, params: params ?? [] }; },
  assign(lvalue, expr) { return { kind: 'Assign', lvalue, expr }; },
  augAssign(lvalue, op, expr) { return { kind: 'AugAssign', lvalue, op, expr }; },
  require(cond, msg) { return { kind: 'Require', cond, msg: msg ?? null }; },
  emit(name, args) { return { kind: 'Emit', name, args }; },
  return(expr) { return { kind: 'Return', expr: expr ?? null }; },
  revert(msg) { return { kind: 'Revert', msg }; },
  revertError(name, args) { return { kind: 'RevertError', name, args: args ?? [] }; },
  send(to, amount) { return { kind: 'Send', to, amount }; },
  exprStmt(expr) { return { kind: 'ExprStmt', expr }; },
  id(name) { return { kind: 'Id', name }; },
  literal(type, value) { return { kind: 'Literal', type, value }; },
  binary(left, op, right) { return { kind: 'Binary', left, op, right }; },
  unary(op, expr) { return { kind: 'Unary', op, expr }; },
  subscript(obj, index) { return { kind: 'Subscript', obj, index }; },
  member(obj, prop) { return { kind: 'Member', obj, prop }; },
  call(fn, args) { return { kind: 'Call', fn, args }; },
  namedArg(name, expr) { return { kind: 'NamedArg', name, expr }; },
};

// ─── Expressions (precedence climbing) ─────────────────────────────────────
function parseExpr() {
  return parseOr();
}
function parseOr() {
  let left = parseAnd();
  while (is(TokenType.Keyword, 'or')) {
    advance();
    left = AST.binary(left, 'or', parseAnd());
  }
  return left;
}
function parseAnd() {
  let left = parseNot();
  while (is(TokenType.Keyword, 'and')) {
    advance();
    left = AST.binary(left, 'and', parseNot());
  }
  return left;
}
function parseNot() {
  if (is(TokenType.Keyword, 'not')) {
    advance();
    return AST.unary('not', parseNot());
  }
  return parseCompare();
}
const CMP_OPS = ['==', '!=', '<', '>', '<=', '>='];
function parseCompare() {
  let left = parseAdd();
  const op = peek().type === TokenType.Op && CMP_OPS.includes(peek().value) ? peek().value : null;
  if (op) {
    advance();
    left = AST.binary(left, op, parseAdd());
  }
  return left;
}
function parseAdd() {
  let left = parseMul();
  while (peek().type === TokenType.Op && (peek().value === '+' || peek().value === '-')) {
    const op = peek().value;
    advance();
    left = AST.binary(left, op, parseMul());
  }
  return left;
}
function parseMul() {
  let left = parseUnary();
  while (peek().type === TokenType.Op && ['*', '/', '%'].includes(peek().value)) {
    const op = peek().value;
    advance();
    left = AST.binary(left, op, parseUnary());
  }
  return left;
}
function parseUnary() {
  if (peek().type === TokenType.Op && peek().value === '-') {
    advance();
    return AST.unary('-', parseUnary());
  }
  return parsePostfix();
}
function parsePostfix() {
  let e = parsePrimary();
  for (;;) {
    if (peek().type === TokenType.Op && peek().value === '[') {
      advance();
      const index = parseExpr();
      expect(TokenType.Op, ']');
      e = AST.subscript(e, index);
    } else if (peek().type === TokenType.Op && peek().value === '.') {
      advance();
      const prop = expect(TokenType.Identifier).value;
      e = AST.member(e, prop);
    } else if (peek().type === TokenType.Op && peek().value === '(') {
      advance();
      skipNewlines();
      while (is(TokenType.Indent)) advance(); // continuation indent inside parentheses
      const args = [];
      if (!is(TokenType.Op, ')')) {
        if (is(TokenType.Identifier) && peek().value && tokens[pos + 1]?.value === ':') {
          while (!is(TokenType.Op, ')')) {
            skipNewlines();
            while (is(TokenType.Indent)) advance();
            const name = expect(TokenType.Identifier).value;
            expect(TokenType.Op, ':');
            args.push(AST.namedArg(name, parseExpr()));
            skipNewlines();
            while (is(TokenType.Indent)) advance();
            while (is(TokenType.Dedent)) advance(); // closing paren on its own line
            if (!is(TokenType.Op, ')')) expect(TokenType.Op, ',');
          }
        } else {
          args.push(parseExpr());
          while (is(TokenType.Op, ',')) {
            advance();
            skipNewlines();
            args.push(parseExpr());
          }
        }
      }
      expect(TokenType.Op, ')');
      e = AST.call(e, args);
    } else break;
  }
  return e;
}
function parsePrimary() {
  if (is(TokenType.Number)) {
    const t = peek();
    advance();
    let value = t.value;
    if (peek().type === TokenType.Unit) {
      const unit = peek().value;
      advance();
      value = { number: t.value, unit };
    }
    return AST.literal('number', value);
  }
  if (is(TokenType.String)) { const v = peek().value; advance(); return AST.literal('string', v); }
  if (is(TokenType.Address)) { const v = peek().value; advance(); return AST.literal('address', v); }
  if (is(TokenType.Keyword, 'true')) { advance(); return AST.literal('bool', true); }
  if (is(TokenType.Keyword, 'false')) { advance(); return AST.literal('bool', false); }
  if (is(TokenType.Keyword, 'self')) { advance(); return AST.id('self'); }
  if (is(TokenType.Identifier) || is(TokenType.Keyword)) {
    const name = peek().value;
    advance();
    return AST.id(name);
  }
  if (is(TokenType.Op, '(')) {
    advance();
    const e = parseExpr();
    expect(TokenType.Op, ')');
    return e;
  }
  throw new Error(`Unexpected token at line ${peek().line}: ${JSON.stringify(peek())}`);
}

// ─── Lvalue ────────────────────────────────────────────────────────────────
function parseLvalue() {
  const first = expect(TokenType.Identifier).value;
  let e = AST.id(first);
  while (peek().type === TokenType.Op && peek().value === '[') {
    advance();
    const index = parseExpr();
    expect(TokenType.Op, ']');
    e = AST.subscript(e, index);
    if (peek().type === TokenType.Op && peek().value === '[') {
      advance();
      const index2 = parseExpr();
      expect(TokenType.Op, ']');
      e = AST.subscript(e, index2);
    }
  }
  if (peek().type === TokenType.Op && peek().value === '.') {
    advance();
    e = AST.member(e, expect(TokenType.Identifier).value);
  }
  return e;
}

// ─── Block (indented statement list) ────────────────────────────────────────
function parseBlock() {
  expect(TokenType.Newline);
  expect(TokenType.Indent);
  const body = [];
  while (!is(TokenType.Dedent) && !is(TokenType.EOF)) {
    const s = parseStatement();
    if (s) body.push(s);
  }
  expect(TokenType.Dedent);
  return body;
}

// ─── Statements ────────────────────────────────────────────────────────────
function parseStatement() {
  skipNewlines();
  if (is(TokenType.Dedent) || is(TokenType.EOF)) return null;

  if (is(TokenType.Keyword, 'if')) {
    advance();
    const cond = parseExpr();
    expect(TokenType.Op, ':');
    const thenBody = parseBlock();
    const elifs = [];
    while (is(TokenType.Keyword, 'elif')) {
      advance();
      const elifCond = parseExpr();
      expect(TokenType.Op, ':');
      elifs.push({ cond: elifCond, body: parseBlock() });
    }
    let elseBody = null;
    if (is(TokenType.Keyword, 'else')) {
      advance();
      expect(TokenType.Op, ':');
      elseBody = parseBlock();
    }
    return AST.ifStmt(cond, thenBody, elifs, elseBody);
  }
  if (is(TokenType.Keyword, 'match')) {
    advance();
    const expr = parseExpr();
    expect(TokenType.Op, ':');
    expect(TokenType.Newline);
    expect(TokenType.Indent);
    const arms = [];
    while (!is(TokenType.Dedent) && !is(TokenType.EOF)) {
      const variant = expect(TokenType.Identifier).value;
      expect(TokenType.Op, ':');
      expect(TokenType.Newline);
      expect(TokenType.Indent);
      const armBody = [];
      while (!is(TokenType.Dedent) && !is(TokenType.EOF)) {
        const s = parseStatement();
        if (s) armBody.push(s);
      }
      expect(TokenType.Dedent);
      arms.push(AST.matchArm(variant, armBody));
    }
    expect(TokenType.Dedent);
    return AST.match(expr, arms);
  }
  if (is(TokenType.Keyword, 'for')) {
    advance();
    const id = expect(TokenType.Identifier).value;
    expect(TokenType.Keyword, 'in');
    const iter = parseExpr();
    expect(TokenType.Op, ':');
    return AST.forStmt(id, iter, parseBlock());
  }
  if (is(TokenType.Keyword, 'while')) {
    advance();
    const cond = parseExpr();
    expect(TokenType.Op, ':');
    return AST.whileStmt(cond, parseBlock());
  }

  if (is(TokenType.Keyword, 'require')) {
    advance();
    const cond = parseExpr();
    let msg = null;
    if (is(TokenType.Op, ',')) { advance(); msg = expect(TokenType.String).value; }
    skipNewlines();
    return AST.require(cond, msg);
  }
  if (is(TokenType.Keyword, 'revert')) {
    advance();
    if (is(TokenType.String)) {
      const msg = expect(TokenType.String).value;
      skipNewlines();
      return AST.revert(msg);
    }
    if (is(TokenType.Identifier) || is(TokenType.Keyword)) {
      const name = advance().value;
      expect(TokenType.Op, '(');
      const args = [];
      if (!is(TokenType.Op, ')')) {
        do {
          args.push(parseExpr());
        } while (is(TokenType.Op, ',') && advance());
      }
      expect(TokenType.Op, ')');
      skipNewlines();
      return AST.revertError(name, args);
    }
    throw new Error(`Expected string or error name after revert at line ${peek().line}`);
  }
  if (is(TokenType.Keyword, 'emit')) {
    advance();
    const name = expect(TokenType.Identifier).value;
    expect(TokenType.Op, '(');
    const args = [];
    if (!is(TokenType.Op, ')')) {
      do {
        if (is(TokenType.Op, ')')) break;
        const t = peek();
        const n = (t.type === TokenType.Identifier || t.type === TokenType.Keyword) ? advance().value : null;
        if (!n) throw new Error(`Expected argument name at line ${peek().line}`);
        expect(TokenType.Op, ':');
        args.push(AST.namedArg(n, parseExpr()));
      } while (is(TokenType.Op, ',') && advance());
    }
    expect(TokenType.Op, ')');
    skipNewlines();
    return AST.emit(name, args);
  }
  if (is(TokenType.Keyword, 'return')) {
    advance();
    const expr = is(TokenType.Newline) || is(TokenType.Dedent) ? null : parseExpr();
    skipNewlines();
    return AST.return(expr);
  }
  if (is(TokenType.Keyword, 'send')) {
    advance();
    expect(TokenType.Op, '(');
    const to = parseExpr();
    expect(TokenType.Op, ',');
    const amount = parseExpr();
    expect(TokenType.Op, ')');
    skipNewlines();
    return AST.send(to, amount);
  }

  const lvalue = parseLvalue();
  if (is(TokenType.Op, '=')) {
    advance();
    const expr = parseExpr();
    skipNewlines();
    return AST.assign(lvalue, expr);
  }
  if (['+=', '-=', '*=', '/='].includes(peek().value)) {
    const op = peek().value;
    advance();
    const expr = parseExpr();
    skipNewlines();
    return AST.augAssign(lvalue, op, expr);
  }
  skipNewlines();
  return AST.exprStmt(lvalue);
}

// ─── Contract body ──────────────────────────────────────────────────────────
function parseContractBody() {
  const stateVars = [];
  const events = [];
  const structs = [];
  const enums = [];
  const errors = [];
  const functions = [];
  skipNewlines();

  while (!is(TokenType.Dedent) && !is(TokenType.EOF)) {
    if (is(TokenType.Keyword, 'struct')) {
      advance();
      const name = expect(TokenType.Identifier).value;
      expect(TokenType.Op, ':');
      expect(TokenType.Newline);
      expect(TokenType.Indent);
      const fields = [];
      while (!is(TokenType.Dedent) && !is(TokenType.EOF)) {
        const t = peek();
        if (t.type === TokenType.Identifier || t.type === TokenType.Keyword) {
          fields.push(t.value);
          advance();
          skipNewlines();
        } else break;
      }
      expect(TokenType.Dedent);
      structs.push(AST.struct(name, fields));
      continue;
    }
    if (is(TokenType.Keyword, 'enum')) {
      advance();
      const name = expect(TokenType.Identifier).value;
      expect(TokenType.Op, ':');
      expect(TokenType.Newline);
      expect(TokenType.Indent);
      const variants = [];
      while (!is(TokenType.Dedent) && !is(TokenType.EOF)) {
        const t = peek();
        if (t.type === TokenType.Identifier || t.type === TokenType.Keyword) {
          variants.push(t.value);
          advance();
          skipNewlines();
        } else break;
      }
      expect(TokenType.Dedent);
      enums.push(AST.enum(name, variants));
      continue;
    }
    if (is(TokenType.Keyword, 'event')) {
      advance();
      const name = expect(TokenType.Identifier).value;
      const params = [];
      if (is(TokenType.Op, '(')) {
        advance();
        while (!is(TokenType.Op, ')')) {
          const t = peek();
          if (t.type === TokenType.Identifier || t.type === TokenType.Keyword) { advance(); params.push(t.value); }
          else break;
          if (!is(TokenType.Op, ')')) expect(TokenType.Op, ',');
        }
        expect(TokenType.Op, ')');
      }
      skipNewlines();
      events.push(AST.event(name, params));
      continue;
    }
    if (is(TokenType.Keyword, 'error')) {
      advance();
      const name = expect(TokenType.Identifier).value;
      expect(TokenType.Op, '(');
      const params = [];
      if (!is(TokenType.Op, ')')) {
        while (true) {
          const t = peek();
          if (t.type === TokenType.Identifier || t.type === TokenType.Keyword) { advance(); params.push(t.value); }
          else break;
          if (!is(TokenType.Op, ')')) expect(TokenType.Op, ',');
          else break;
        }
      }
      expect(TokenType.Op, ')');
      skipNewlines();
      errors.push(AST.error(name, params));
      continue;
    }
    if (is(TokenType.Keyword, 'receive')) {
      advance();
      expect(TokenType.Op, '(');
      expect(TokenType.Op, ')');
      expect(TokenType.Op, ':');
      expect(TokenType.Newline);
      expect(TokenType.Indent);
      const guards = [];
      const body = [];
      for (;;) {
        skipNewlines();
        if (is(TokenType.Dedent)) break;
        if (is(TokenType.Keyword, 'payable')) { advance(); guards.push(AST.guardPayable()); skipNewlines(); continue; }
        const stmt = parseStatement();
        if (stmt) body.push(stmt);
      }
      expect(TokenType.Dedent);
      functions.push(AST.fn('receive', [], guards, body));
      continue;
    }
    if (is(TokenType.Keyword, 'fallback')) {
      advance();
      expect(TokenType.Op, '(');
      expect(TokenType.Op, ')');
      expect(TokenType.Op, ':');
      expect(TokenType.Newline);
      expect(TokenType.Indent);
      const guards = [];
      const body = [];
      for (;;) {
        skipNewlines();
        if (is(TokenType.Dedent)) break;
        const stmt = parseStatement();
        if (stmt) body.push(stmt);
      }
      expect(TokenType.Dedent);
      functions.push(AST.fn('fallback', [], guards, body));
      continue;
    }
    if (is(TokenType.Keyword, 'function')) {
      advance();
      const name = expect(TokenType.Identifier).value;
      expect(TokenType.Op, '(');
      const params = [];
      if (!is(TokenType.Op, ')')) {
        while (true) {
          const t = peek();
          if (t.type === TokenType.Identifier || t.type === TokenType.Keyword) { advance(); params.push(t.value); }
          else break;
          if (!is(TokenType.Op, ')')) expect(TokenType.Op, ',');
          else break;
        }
      }
      expect(TokenType.Op, ')');
      expect(TokenType.Op, ':');
      expect(TokenType.Newline);
      expect(TokenType.Indent);
      const guards = [];
      const body = [];
      for (;;) {
        skipNewlines();
        if (is(TokenType.Dedent)) break;
        if (is(TokenType.Keyword, 'only')) {
          advance();
          guards.push(AST.guardOnly(parseExpr()));
          skipNewlines();
          continue;
        }
        if (is(TokenType.Keyword, 'lock')) { advance(); guards.push(AST.guardLock()); skipNewlines(); continue; }
        if (is(TokenType.Keyword, 'payable')) { advance(); guards.push(AST.guardPayable()); skipNewlines(); continue; }
        if (is(TokenType.Keyword, 'override')) { advance(); guards.push(AST.guardOverride()); skipNewlines(); continue; }
        const stmt = parseStatement();
        if (stmt) body.push(stmt);
      }
      expect(TokenType.Dedent);
      functions.push(AST.fn(name, params, guards, body));
      continue;
    }
    if (is(TokenType.Identifier) || is(TokenType.Keyword)) {
      const name = peek().value;
      advance();
      if (is(TokenType.Op, '=')) {
        advance();
        const init = parseExpr();
        skipNewlines();
        stateVars.push(AST.stateVar(name, init, []));
      } else if (is(TokenType.Op, '[')) {
        advance();
        if (is(TokenType.Op, ']')) {
          advance();
          skipNewlines();
          stateVars.push(AST.stateVar(name, null, [], true));
        } else {
          const k1 = (peek().type === TokenType.Identifier || peek().type === TokenType.Keyword) ? advance().value : null;
          if (!k1) throw new Error(`Expected mapping key type (identifier or number/uint) at line ${peek().line}`);
          expect(TokenType.Op, ']');
          const keys = [k1];
          if (is(TokenType.Op, '[')) {
            advance();
            const k2 = (peek().type === TokenType.Identifier || peek().type === TokenType.Keyword) ? advance().value : null;
            if (!k2) throw new Error(`Expected mapping key type at line ${peek().line}`);
            keys.push(k2);
            expect(TokenType.Op, ']');
          }
          skipNewlines();
          stateVars.push(AST.stateVar(name, null, keys));
        }
      } else {
        throw new Error(`Expected = or [ after state var at line ${peek().line}`);
      }
      continue;
    }
    break;
  }
  return { stateVars, events, structs, enums, errors, functions };
}

// ─── Interface (top-level) ──────────────────────────────────────────────────
function parseInterface() {
  expect(TokenType.Keyword, 'interface');
  const name = expect(TokenType.Identifier).value;
  expect(TokenType.Op, ':');
  expect(TokenType.Newline);
  expect(TokenType.Indent);
  const signatures = [];
  while (!is(TokenType.Dedent) && !is(TokenType.EOF)) {
    skipNewlines();
    if (is(TokenType.Dedent)) break;
    if (is(TokenType.Keyword, 'contract') || is(TokenType.Keyword, 'interface') || is(TokenType.Keyword, 'import')) break;
    if (is(TokenType.Keyword, 'function')) {
      advance();
      const fnName = expect(TokenType.Identifier).value;
      expect(TokenType.Op, '(');
      const params = [];
      if (!is(TokenType.Op, ')')) {
        do {
          if (is(TokenType.Op, ')')) break;
          const t = peek();
          const n = (t.type === TokenType.Identifier || t.type === TokenType.Keyword) ? advance().value : null;
          if (!n) throw new Error(`Expected param name at line ${peek().line}`);
          expect(TokenType.Op, ':');
          params.push(AST.namedArg(n, parseExpr()));
        } while (is(TokenType.Op, ',') && advance());
      }
      expect(TokenType.Op, ')');
      expect(TokenType.Op, ':');
      skipNewlines();
      signatures.push(AST.fnSignature(fnName, params));
    } else break;
  }
  if (is(TokenType.Dedent)) advance();
  return AST.interface(name, signatures);
}

// ─── Import (top-level) ─────────────────────────────────────────────────────
function parseImport() {
  expect(TokenType.Keyword, 'import');
  const module = expect(TokenType.Identifier).value;
  let path = null;
  if (is(TokenType.Keyword, 'from')) {
    advance();
    path = expect(TokenType.String).value;
  }
  skipNewlines();
  return AST.importStmt(module, path);
}

// ─── Test block (top-level): test "name" { expect fn() == value } ───────────
function parseTestBlock() {
  expect(TokenType.Keyword, 'test');
  const nameTok = expect(TokenType.String);
  const name = nameTok.value;
  expect(TokenType.Op, '{');
  skipNewlines();
  if (is(TokenType.Indent)) advance();
  expect(TokenType.Keyword, 'expect');
  const expr = parseExpr();
  if (expr.kind !== 'Binary' || !CMP_OPS.includes(expr.op)) {
    throw new Error(`Expected comparison (e.g. get() == 42) in test at line ${peek().line}`);
  }
  skipNewlines();
  while (is(TokenType.Dedent)) advance();
  expect(TokenType.Op, '}');
  return AST.test(name, expr.left, expr.op, expr.right);
}

// ─── Top level ─────────────────────────────────────────────────────────────
function parseContract() {
  const isAbstract = is(TokenType.Keyword, 'abstract');
  if (isAbstract) advance();
  expect(TokenType.Keyword, 'contract');
  const name = expect(TokenType.Identifier).value;
  let bases = [];
  if (is(TokenType.Keyword, 'is')) {
    advance();
    bases.push(expect(TokenType.Identifier).value);
    while (is(TokenType.Op, ',')) {
      advance();
      bases.push(expect(TokenType.Identifier).value);
    }
  }
  if (is(TokenType.Op, ':')) advance();
  expect(TokenType.Newline);
  expect(TokenType.Indent);
  const body = parseContractBody();
  expect(TokenType.Dedent);
  return AST.contract(name, body, bases, isAbstract);
}

export function parse(source) {
  tokens = lex(source);
  pos = 0;
  skipNewlines();
  const contracts = [];
  const interfaces = [];
  const imports = [];
  const tests = [];
  while (!is(TokenType.EOF)) {
    if (is(TokenType.Keyword, 'contract') || is(TokenType.Keyword, 'abstract')) contracts.push(parseContract());
    else if (is(TokenType.Keyword, 'interface')) interfaces.push(parseInterface());
    else if (is(TokenType.Keyword, 'import')) imports.push(parseImport());
    else if (is(TokenType.Keyword, 'test')) tests.push(parseTestBlock());
    else if (is(TokenType.Newline)) { do { advance(); } while (is(TokenType.Newline)); }
    else if (is(TokenType.Dedent)) advance();
    else throw new Error(`Expected contract, interface, import, or test at line ${peek().line}`);
  }
  return AST.program(contracts, interfaces, imports, tests);
}
