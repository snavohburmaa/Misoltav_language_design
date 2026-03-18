#!/usr/bin/env node
/**
 * Misoltav playground server: serves the website and runs the real compiler on /api/compile.
 * Run: node server.js
 * Then open http://localhost:3000 and use Try it → Run (real compile).
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

function startServer(port) {
  app.listen(port, () => {
    console.log(`Misoltav playground: http://localhost:${port}`);
    console.log('  Try it → Run uses the real compiler. Deploy tab is simulated.');
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const next = port + 1;
      console.warn(`Port ${port} in use, trying ${next}...`);
      startServer(next);
    } else throw err;
  });
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'website')));

app.post('/api/compile', async (req, res) => {
  const code = req.body?.code;
  if (typeof code !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing or invalid body.code' });
  }
  try {
    const { compile } = await import('./compiler/compile.js');
    const out = compile(code);
    res.json({ ok: true, bytecode: out.bytecode, runtimeBytecode: out.runtimeBytecode, abi: out.abi, contractName: out.contractName });
  } catch (e) {
    const message = e.message || String(e);
    const line = e.line != null ? e.line : (e.location?.start?.line);
    res.json({ ok: false, error: message, line: line != null ? line : undefined });
  }
});

// Run contract in local EVM and optionally call a view function (for playground)
app.post('/api/run', async (req, res) => {
  const code = req.body?.code;
  const callFn = req.body?.callFn ?? null;
  if (typeof code !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing or invalid body.code' });
  }
  try {
    const { compile } = await import('./compiler/compile.js');
    const { runCompiled } = await import('./compiler/run-vm.js');
    const compiled = compile(code);
    const exec = await runCompiled(
      { bytecode: compiled.bytecode, runtimeBytecode: compiled.runtimeBytecode, abi: compiled.abi },
      callFn || null,
      []
    );
    res.json({
      ok: true,
      contractName: compiled.contractName,
      runtimeSize: exec.runtimeSize,
      deployGasUsed: exec.deployGasUsed,
      callResult: exec.callResult,
      callGasUsed: exec.callGasUsed,
      callError: exec.callError || null,
    });
  } catch (e) {
    res.json({ ok: false, error: e.message || String(e) });
  }
});

app.get('/playground', (req, res) => {
  res.sendFile(path.join(__dirname, 'website', 'playground.html'));
});
app.get('/playground.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'website', 'playground.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'website', 'index.html'));
});

startServer(PORT);
