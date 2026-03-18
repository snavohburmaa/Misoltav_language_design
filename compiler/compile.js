/**
 * Main entry: compile Misoltav natively to EVM bytecode + ABI (no Solidity).
 * For Solidity transpilation use transpileToSolidity().
 */
export { compile, compileToBytecode } from './emit-evm.js';
export { compile as transpileToSolidity } from './emit-solidity.js';
export { parse } from './parser.js';
export { lex } from './lexer.js';
