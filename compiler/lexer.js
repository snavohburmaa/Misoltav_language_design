/**
 * Misoltav lexer — tokenizes source with INDENT/DEDENT for block structure.
 * Uses 4 spaces per indent level.
 */

const KEYWORDS = new Set([
  'contract', 'interface', 'function', 'event', 'struct', 'enum', 'import', 'from',
  'only', 'lock', 'payable', 'require', 'emit', 'return', 'revert', 'send',
  'if', 'elif', 'else', 'match', 'for', 'in', 'while',
  'and', 'or', 'not', 'true', 'false', 'self',
  'is', 'override', 'abstract', 'receive', 'fallback', 'error', 'virtual',
  'test', 'expect'
]);

export const TokenType = {
  Keyword: 'Keyword',
  Identifier: 'Identifier',
  Number: 'Number',
  String: 'String',
  Address: 'Address',
  Unit: 'Unit',
  Op: 'Op',
  Newline: 'Newline',
  Indent: 'Indent',
  Dedent: 'Dedent',
  EOF: 'EOF'
};

export function token(type, value, line, col) {
  return { type, value, line, col };
}

export function lex(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const indentStack = [0];
  const lines = source.split('\n');

  function peek() { return source[i] ?? ''; }
  function advance() {
    if (i < source.length) {
      if (source[i] === '\n') { line++; col = 1; } else { col++; }
      i++;
    }
    return peek();
  }
  function skipSpaces() {
    while (peek() === ' ' || peek() === '\t') advance();
  }
  function skipComment() {
    if (peek() === '-' && source[i + 1] === '-') {
      while (i < source.length && peek() !== '\n') advance();
      return true;
    }
    return false;
  }

  function readIndent() {
    let spaces = 0;
    const start = i;
    while (peek() === ' ') { spaces++; advance(); }
    while (peek() === '\t') advance(); // treat tab as space for simplicity
    if (peek() === '\n' || i >= source.length) return 0;
    return i - start;
  }

  function emitNewlineAndIndent() {
    const indent = readIndent();
    if (indent > 0 || (peek() !== '\n' && peek() !== '')) {
      if (indent > indentStack[indentStack.length - 1]) {
        indentStack.push(indent);
        tokens.push(token(TokenType.Indent, undefined, line, col));
      } else {
        while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
          indentStack.pop();
          tokens.push(token(TokenType.Dedent, undefined, line, col));
        }
        if (indent !== indentStack[indentStack.length - 1] && indent > 0) {
          throw new Error(`Line ${line}: inconsistent indentation`);
        }
      }
    }
  }

  while (i < source.length) {
    skipSpaces();
    if (peek() === '') break;
    if (peek() === '\n') {
      advance();
      tokens.push(token(TokenType.Newline, '\n', line, col));
      emitNewlineAndIndent();
      continue;
    }
    if (skipComment()) continue;

    const startLine = line;
    const startCol = col;

    // String "..."
    if (peek() === '"') {
      advance();
      let val = '';
      while (peek() !== '"' && i < source.length) {
        if (peek() === '\\') { advance(); val += peek(); advance(); }
        else { val += peek(); advance(); }
      }
      if (peek() === '"') advance();
      tokens.push(token(TokenType.String, val, startLine, startCol));
      continue;
    }

    // Number or unit literal
    if (/[0-9]/.test(peek())) {
      let val = '';
      while (/[0-9_]/.test(peek())) { val += peek(); advance(); }
      const num = val.replace(/_/g, '');
      tokens.push(token(TokenType.Number, num, startLine, startCol));
      skipSpaces();
      const unitStart = i;
      let unit = '';
      while (/[a-zA-Z]/.test(peek())) { unit += peek(); advance(); }
      if (['ether','wei','gwei','seconds','minutes','hours','days'].includes(unit)) {
        tokens.push(token(TokenType.Unit, unit, line, col));
      } else if (unit.length > 0) {
        i = unitStart;
        col = source.slice(0, i).split('\n').pop().length;
      }
      continue;
    }

    // Address 0x...
    if (peek() === '0' && source[i + 1] === 'x') {
      let val = '';
      advance(); advance();
      val = '0x';
      while (/[0-9a-fA-F]/.test(peek())) { val += peek(); advance(); }
      tokens.push(token(TokenType.Address, val, startLine, startCol));
      continue;
    }

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(peek())) {
      let val = '';
      while (/[a-zA-Z0-9_]/.test(peek())) { val += peek(); advance(); }
      const type = KEYWORDS.has(val) ? TokenType.Keyword : TokenType.Identifier;
      tokens.push(token(type, val, startLine, startCol));
      continue;
    }

    // Operators and punctuation
    const two = source.slice(i, i + 2);
    const twoOps = ['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '->'];
    if (twoOps.includes(two)) {
      advance(); advance();
      tokens.push(token(TokenType.Op, two, startLine, startCol));
      continue;
    }
    const one = peek();
    if ('()[]{}.,:;=<>+-*/%'.includes(one)) {
      advance();
      tokens.push(token(TokenType.Op, one, startLine, startCol));
      continue;
    }

    advance();
  }

  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push(token(TokenType.Dedent, undefined, line, col));
  }
  tokens.push(token(TokenType.Newline, '\n', line, col));
  tokens.push(token(TokenType.EOF, undefined, line, col));
  return tokens;
}
