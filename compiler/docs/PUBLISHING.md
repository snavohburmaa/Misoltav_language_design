# Publishing Misoltav (CLI + VS Code extension)

## Publish CLI to npm

1. **Prepare the package**
   - From repo root: `cd compiler`
   - Ensure `package.json` has correct `name` (e.g. `misolc`), `version`, `description`, `license`, `repository`, `files`, `bin`, `engines`
   - Run `npm install` and verify:
     - `node cli.js build examples/SimpleGet.miso`
     - `node cli.js test examples/SimpleGet.miso`

2. **Publish**
   - Create an npm account at [npmjs.com](https://www.npmjs.com/) if needed
   - `npm login`
   - Bump version: `npm version patch` (or minor/major)
   - `npm publish` (use `npm publish --access public` if the package is scoped and should be public)

3. **Verify**
   - `npm install -g misolc`
   - `misolc --version`
   - `misolc build examples/SimpleGet.miso` (from a folder that has or can reach examples)

---

## Publish VS Code extension

1. **Install vsce**
   - `npm install -g @vscode/vsce`

2. **Package**
   - `cd miso-extension` (from repo root)
   - `npm install`
   - `vsce package`  
   - This produces `misoltav-language-0.1.0.vsix` (or current version).

3. **Publish to Marketplace**
   - Create a [Visual Studio Marketplace](https://marketplace.visualstudio.com/) publisher account (one-time, free)
   - `vsce login <publisher-id>` (e.g. `misoltav`)
   - `vsce publish`  
   - Or upload the `.vsix` manually: [Publish Extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publish-to-vs-code-marketplace)

4. **Optional: Open VSIX locally**
   - In VS Code: Extensions view → "..." → "Install from VSIX" → select the generated `.vsix`

---

## Docs and examples

- **README**: `compiler/README.md` — install, quick start, CLI table, test blocks, real-world readiness
- **Examples**: `compiler/examples/` — SimpleGet.miso (tests), HelloWorld.miso, Token.miso, ControlFlow.miso
- Update version and changelog when cutting releases.
