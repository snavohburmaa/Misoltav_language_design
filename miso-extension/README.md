# Misoltav VS Code / Cursor Extension

Adds **syntax highlighting**, **diagnostics**, **completions**, and **go-to-definition** for `.miso` (Misoltav) files.

## Features

- **Syntax highlighting** — Keywords, strings, addresses, numbers, comments
- **Diagnostics** — Parse errors from the Misoltav parser (underlined in the editor)
- **Completions** — Keywords and symbols (state vars, functions, events, structs, enums, interfaces)
- **Go to definition** — Jump to where a symbol is defined (state var, function, event, etc.)
- **Check on save** — Optionally run `misolc check` when you save a `.miso` file (status bar message)

## Installation

### From source (this repo)

1. Open the repo in VS Code or Cursor.
2. Install dependencies (if not already):
   ```bash
   cd miso-extension && npm install
   cd server && npm install
   ```
3. Press **F5** (or Run > Start Debugging) to launch an Extension Development Host with the extension loaded.
4. In the new window, open a folder that contains `.miso` files (e.g. `compiler/examples`) and try editing a file.

### Package and install as VSIX

```bash
cd miso-extension
npx vsce package
# Install the generated .vsix: Extensions view → ... → Install from VSIX
```

**Important:** After installing from VSIX, **open the newlanguage repo as a folder** (File → Open Folder → choose `newlanguage`). The language server looks for the compiler at `<workspace root>/compiler`. If the workspace root is the repo, you get diagnostics, completions, and go-to-definition. If you open a different folder, the server will warn "parser not found" and only keyword completions will work.

## Settings

| Setting | Default | Description |
|--------|---------|-------------|
| `misoltav.runCheckOnSave` | `true` | Run `misolc check` when saving a `.miso` file |
| `misoltav.misolcPath` | `"node"` | Path to Node (or full command) used to run the compiler CLI |

Check-on-save runs `node <path-to-compiler>/cli.js check <file>`. The compiler path is resolved as `miso-extension/../compiler` when the extension lives inside the Misoltav repo.

## Troubleshooting

**"Nothing changed" after installing the VSIX?**
1. **Reload the window** after installing (Command Palette → "Developer: Reload Window").
2. **Open the repo as a folder**: File → Open Folder → select the `newlanguage` folder (the one that contains both `compiler` and `miso-extension`). The server needs this workspace root to find `compiler/parser.js`.
3. Open a `.miso` file and confirm the status bar shows "Misoltav" (language mode). If not, click the language indicator and select "Misoltav".

## Requirements

- **Node.js** (for the language server and for check-on-save)
- **VS Code** or **Cursor** ^1.74.0
