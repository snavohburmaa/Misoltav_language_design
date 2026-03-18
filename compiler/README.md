# Misolc — Misoltav compiler and transpiler

Compile **Misoltav** (`.miso`) to **EVM bytecode + ABI** (native) or to **Solidity** (`.sol`) for deployment with [Foundry](https://book.getfoundry.sh/), [Hardhat](https://hardhat.org/), or any Solidity toolchain.

## Requirements

- **Node.js 18+**

## Install

```bash
# From repo (use locally without publishing)
cd compiler
npm install
npm link          # makes `misolc` available globally on your machine
misolc --version
misolc build examples/SimpleGet.miso
```

If you don’t run `npm link`, use the CLI via Node from the `compiler` folder:

```bash
cd compiler
node cli.js build examples/SimpleGet.miso
node cli.js test examples/SimpleGet.miso
```

**From npm** (once the package is published):

```bash
npm install -g misolc
```

## Quick start

```bash
# Build (compile to bytecode + ABI)
misolc build examples/Token.miso
# → Token.json

# Run (compile + optional local EVM)
misolc run examples/HelloWorld.miso --execute --call getGreeting

# Test (run test blocks)
misolc test examples/SimpleGet.miso
# ✔ get returns 42
# ✖ set returns wrong value — expected == 0, got 42

# Other commands
misolc compile examples/Token.miso -o out.json   # alias for build
misolc transpile examples/Token.miso -o out.sol # emit Solidity
misolc check examples/Token.miso                # parse + validate
misolc abi examples/Token.miso -o abi.json     # ABI only
misolc fmt examples/Token.miso                  # format
```

## Use the generated Solidity

1. **With Foundry**
   ```bash
   node cli.js transpile examples/Token.miso -o src/Token.sol
   forge build
   forge test
   forge deploy
   ```

2. **With Hardhat**
   - Copy the generated `.sol` into your `contracts/` folder, then `npx hardhat compile` and deploy as usual.

## What is supported

- **Contracts**: single or multiple per file; `abstract contract`; inheritance (`contract A is B, C`).
- **State**: simple vars, mappings (`balance[address]`, `proposals[number]`), array-like `items[]`, structs, enums.
- **Events** and **errors**: `event Name(a, b)`, `error Name(x, y)`, `emit`, `revert Name(...)`.
- **Functions**: `only`, `lock`, `payable`, `override`; `constructor`, `receive()`, `fallback()`.
- **Control flow**: `if`/`elif`/`else`, `match`, `for`, `while` — **native EVM codegen** (not only transpile).
- **Interfaces** and **imports**: top-level `interface`, `import X from "path"`.
- **Context**: `sender`, `value`, `now`, `self` → Solidity equivalents.

**Native backend**: `misolc compile` / `misolc run` produce EVM bytecode and ABI without Solidity. Control flow, expressions, and general function bodies are compiled to bytecode; use `misolc run --execute` to run in a local EVM (requires `@ethereumjs/evm`).

### Test blocks

In a `.miso` file you can add top-level test blocks. `misolc test` compiles the contract, runs each test in the local EVM, and compares the return value to the expected literal:

```miso
contract SimpleGet
    function get():
        return 42

test "get returns 42" {
    expect get() == 42
}

test "get is not zero" {
    expect get() != 0
}
```

Supported comparisons: `==`, `!=`, `<`, `>`, `<=`, `>=`. The left-hand side must be a no-arg function call (e.g. `get()`); the right-hand side must be a literal number (or string/bool for future use).

## CLI commands

| Command | Description |
|---------|-------------|
| `misolc build <file.miso> [-o out.json]` | Compile to bytecode + ABI |
| `misolc run <file.miso> [-o out.json] [--execute] [--call <fn>]` | Compile; `--execute` runs in local EVM, `--call` invokes a view function |
| `misolc test <file.miso>` | Run test blocks (expect fn() == value), print ✔/✖ |
| `misolc compile <file.miso> [-o out.json]` | Alias for build |
| `misolc transpile <file.miso> -o out.sol` | Emit Solidity |
| `misolc check <file.miso>` | Parse and validate only |
| `misolc abi <file.miso> [-o out.json]` | Output ABI JSON |
| `misolc fmt <file.miso> [-o out.miso]` | Format source |

## Standard library (optional)

The `std/` directory may contain reusable modules (e.g. ownership, tokens). Use `import X from "./std/Module.miso"`; the transpiler emits Solidity `import` or inlines as configured. Resolve paths relative to the project or compiler directory.

## IDE extension (VS Code / Cursor)

A **Misoltav extension** in `../miso-extension/` adds:

- Syntax highlighting for `.miso`
- Diagnostics (parse errors)
- Completions (keywords + symbols)
- Go to definition

From repo root: open in VS Code/Cursor, open `miso-extension` folder, press **F5** to run the Extension Development Host, then open a folder with `.miso` files. See `miso-extension/README.md` for details.

## Real-world readiness

| Goal | How |
|------|-----|
| **Use the CLI** | `npm install -g misolc` then `misolc build`, `misolc run`, `misolc test` |
| **Publish to npm** | From `compiler/`: `npm login`, bump version in `package.json`, `npm publish` (see [docs/PUBLISHING.md](docs/PUBLISHING.md)) |
| **Publish VS Code extension** | From `miso-extension/`: `npm run package`, then [publish to Marketplace](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) (see [docs/PUBLISHING.md](docs/PUBLISHING.md)) |
| **Docs + examples** | `compiler/README.md`, `compiler/examples/` (SimpleGet, HelloWorld, Token, ControlFlow), and this README |

## Project layout

```
compiler/
  cli.js           # CLI entry (build, run, test, compile, transpile, check, abi, fmt)
  compile.js       # Re-exports compile, parse, transpileToSolidity
  lexer.js         # Token stream + INDENT/DEDENT
  parser.js        # Recursive-descent AST
  emit-solidity.js # AST → Solidity
  emit-evm.js      # AST → EVM bytecode + ABI
  run-vm.js        # Local EVM execution (run --execute, test)
  run-tests.js     # Test runner (misolc test)
  examples/        # Sample .miso contracts
  docs/            # PUBLISHING.md (npm + VS Code)
  std/             # Optional standard library modules
  README.md
```

## License

Apache-2.0 (same as Misoltav spec).
