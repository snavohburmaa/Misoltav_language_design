/**
 * Misoltav VS Code / Cursor extension — activates LSP client for .miso files.
 * Optionally runs misolc check on save when configured.
 */

const path = require('path');
const vscode = require('vscode');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

function activate(context) {
  const serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio, options: { execArgv: ['--inspect'] } }
  };
  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'misoltav' }],
    synchronize: { fileEvents: vscode.workspace.createFileSystemWatcher('**/*.miso') }
  };
  client = new LanguageClient('misoltav', 'Misoltav Language Server', serverOptions, clientOptions);
  client.start();

  const runCheckOnSave = () => {
    const cfg = vscode.workspace.getConfiguration('misoltav');
    if (!cfg.get('runCheckOnSave', true)) return;
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.miso')) return;
    const doc = editor.document;
    const nodePath = cfg.get('misolcPath', 'node');
    const cliPath = path.join(context.extensionPath, '..', 'compiler', 'cli.js');
    const { exec } = require('child_process');
    exec(`"${nodePath}" "${cliPath}" check "${doc.uri.fsPath}"`, (err, stdout, stderr) => {
      if (err) {
        vscode.window.setStatusBarMessage(`Misoltav check: ${err.message || stderr || 'failed'}`, 5000);
      } else {
        vscode.window.setStatusBarMessage('Misoltav check OK', 3000);
      }
    });
  };

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.languageId === 'misoltav' && doc.uri.scheme === 'file') runCheckOnSave();
    })
  );
}

function deactivate() {
  if (client) return client.stop();
}

module.exports = { activate, deactivate };
