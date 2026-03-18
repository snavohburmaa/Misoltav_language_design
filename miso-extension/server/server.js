/**
 * Misoltav LSP server — diagnostics, completions, go-to-definition.
 * Uses the compiler parser (ESM) via dynamic import.
 */

import { createConnection, TextDocuments, ProposedFeatures } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionCompilerRoot = path.resolve(__dirname, '..', '..', 'compiler');

let parse;
async function loadParser(workspaceRootPath) {
  const candidates = [];
  if (workspaceRootPath) {
    candidates.push(path.join(workspaceRootPath, 'compiler', 'parser.js'));
    candidates.push(path.join(workspaceRootPath, 'parser.js'));
  }
  candidates.push(path.join(extensionCompilerRoot, 'parser.js'));
  for (const p of candidates) {
    try {
      const parserModule = await import(pathToFileURL(p).href);
      return parserModule.parse;
    } catch (_) {}
  }
  return null;
}

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const KEYWORDS = [
  'contract', 'interface', 'function', 'event', 'struct', 'enum', 'import', 'from',
  'only', 'lock', 'payable', 'require', 'emit', 'return', 'revert', 'send',
  'if', 'elif', 'else', 'match', 'for', 'in', 'while', 'and', 'or', 'not',
  'true', 'false', 'self', 'is', 'override', 'abstract', 'receive', 'fallback', 'error', 'virtual'
];

function getDiagnostics(text) {
  const diagnostics = [];
  if (!parse) return diagnostics;
  try {
    parse(text);
  } catch (e) {
    const msg = e.message || String(e);
    const lineMatch = msg.match(/at line (\d+)/);
    const line = lineMatch ? Math.max(0, parseInt(lineMatch[1], 10) - 1) : 0;
    diagnostics.push({
      severity: 1, // Error
      range: { start: { line, character: 0 }, end: { line, character: 1024 } },
      message: msg.replace(/\s*at line \d+\s*$/, '').trim(),
      source: 'misolc'
    });
  }
  return diagnostics;
}

function collectSymbols(ast) {
  const symbols = { stateVars: [], functions: [], events: [], structs: [], enums: [], interfaces: [] };
  if (!ast) return symbols;
  for (const c of ast.contracts || []) {
    for (const s of c.stateVars || []) symbols.stateVars.push(s.name);
    for (const f of c.functions || []) symbols.functions.push(f.name);
    for (const e of c.events || []) symbols.events.push(e.name);
    for (const s of c.structs || []) symbols.structs.push(s.name);
    for (const e of c.enums || []) symbols.enums.push(e.name);
  }
  for (const i of ast.interfaces || []) symbols.interfaces.push(i.name);
  return symbols;
}

function getCompletions(text, line, character) {
  const items = [];
  const lineText = text.split('\n')[line] || '';
  const prefix = lineText.slice(0, character).replace(/.*[\s\[\(:=,]/, '') || lineText.slice(0, character);
  for (const kw of KEYWORDS) {
    if (prefix === '' || kw.startsWith(prefix) || kw.toLowerCase().startsWith(prefix.toLowerCase())) {
      items.push({
        label: kw,
        kind: 14, // Keyword
        insertText: kw
      });
    }
  }
  try {
    const ast = parse(text);
    const sym = collectSymbols(ast);
    const kinds = [
      [sym.stateVars, 6],   // Variable
      [sym.functions, 2],   // Method
      [sym.events, 12],     // Event
      [sym.structs, 22],   // Struct
      [sym.enums, 13],     // Enum
      [sym.interfaces, 8]  // Interface
    ];
    for (const [names, kind] of kinds) {
      for (const name of names) {
        if (prefix === '' || name.startsWith(prefix) || name.toLowerCase().startsWith(prefix.toLowerCase())) {
          items.push({ label: name, kind, insertText: name });
        }
      }
    }
  } catch (_) {}
  return items;
}

function findDefinition(text, word) {
  if (!word) return null;
  const lines = text.split(/\r?\n/);
  const reState = new RegExp(`\\b${escapeRe(word)}\\s*[=\\[]`);
  const reFunction = new RegExp(`\\bfunction\\s+${escapeRe(word)}\\s*\\(`);
  const reEvent = new RegExp(`\\bevent\\s+${escapeRe(word)}\\s*\\(`);
  const reStruct = new RegExp(`\\bstruct\\s+${escapeRe(word)}\\s*:`);
  const reEnum = new RegExp(`\\benum\\s+${escapeRe(word)}\\s*:`);
  const reInterface = new RegExp(`\\binterface\\s+${escapeRe(word)}\\s*:`);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m = line.match(reState) || line.match(reFunction) || line.match(reEvent) ||
            line.match(reStruct) || line.match(reEnum) || line.match(reInterface);
    if (m) {
      const col = m.index;
      return { line: i, character: col };
    }
  }
  return null;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

connection.onInitialize(async (params) => {
  let workspaceRootPath = null;
  const uri = params.workspaceFolders?.[0]?.uri ?? params.rootUri;
  if (uri) {
    try {
      const u = new URL(uri);
      if (u.protocol === 'file:') workspaceRootPath = path.resolve(decodeURIComponent(u.pathname));
    } catch (_) {}
  }
  parse = await loadParser(workspaceRootPath);
  if (!parse) connection.console.warn('Misoltav: parser not found. Open a folder that contains the compiler (e.g. the newlanguage repo).');
  return {
    capabilities: {
      textDocumentSync: 1,
      completionProvider: { triggerCharacters: ['.', ' ', '\n'] },
      definitionProvider: true
    }
  };
});

connection.onDidOpen((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (doc && doc.languageId === 'misoltav') {
    connection.sendDiagnostics({ uri: params.textDocument.uri, diagnostics: getDiagnostics(doc.getText()) });
  }
});

connection.onDidChangeContent((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (doc && doc.languageId === 'misoltav') {
    connection.sendDiagnostics({ uri: params.textDocument.uri, diagnostics: getDiagnostics(doc.getText()) });
  }
});

connection.onCompletion((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const text = doc.getText();
  const { line, character } = params.position;
  return getCompletions(text, line, character);
});

connection.onDefinition((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const text = doc.getText();
  const { line, character } = params.position;
  const lineText = text.split(/\r?\n/)[line] || '';
  const match = lineText.slice(0, character).match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
  const word = match ? match[1] : null;
  const def = findDefinition(text, word);
  if (!def) return null;
  return {
    uri: params.textDocument.uri,
    range: {
      start: { line: def.line, character: def.character },
      end: { line: def.line, character: def.character + (word ? word.length : 0) }
    }
  };
});

documents.listen(connection);
connection.listen();
