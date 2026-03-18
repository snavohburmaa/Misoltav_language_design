/**
 * Misoltav IDE — Remix-style playground: file explorer, editor, compile, run.
 * Files stored in localStorage. Login UI placeholder (Google/GitHub).
 */

const STORAGE_KEY_FILES = 'misoltav_ide_files';
const STORAGE_KEY_USER = 'misoltav_ide_user';
const DEFAULT_FILE = 'contract.miso';
const DEFAULT_CODE = `contract Greeter
    greeting = "Hello, Misoltav!"

    function getGreeting():
        return greeting

    function setGreeting(newGreeting):
        greeting = newGreeting
`;

// ─── State ─────────────────────────────────────────────────────────────────
let files = {}; // { [path]: content }
let activeFileId = DEFAULT_FILE;
let lastCompiled = null; // { bytecode, abi, contractName }
let deployedInstances = []; // { id, contractName, address, abi, code }[]
let deployIdNext = 1;

// ─── Load / save files from localStorage ───────────────────────────────────
function loadFiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FILES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) files = parsed;
    }
  } catch (_) {}
  if (Object.keys(files).length === 0) {
    files[DEFAULT_FILE] = DEFAULT_CODE;
  }
}

function saveFiles() {
  try {
    localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(files));
  } catch (_) {}
}

// ─── DOM ───────────────────────────────────────────────────────────────────
const el = (id) => document.getElementById(id);
const accountGuest = el('ide-account-guest');
const accountUser = el('ide-account-user');
const avatar = el('ide-avatar');
const username = el('ide-username');
const fileTree = el('ide-file-tree');
const tabs = el('ide-tabs');
const editor = el('ide-editor');
const lineNums = el('ide-line-nums');
const compilePre = el('ide-compile-pre');
const consoleEl = el('ide-console');
const contractNameEl = el('ide-contract-name');
const callFnSelect = el('ide-call-fn');
const callResultEl = el('ide-call-result');
const compileBtn = el('ide-compile-btn');
const deployBtn = el('ide-deploy-btn');
const runBtn = el('ide-run-btn');
const callBtn = el('ide-call-btn');
const runSection = el('ide-run-section');
const deployedList = el('ide-deployed-list');
const deployedEmpty = el('ide-deployed-empty');
const deployedBadge = el('ide-deployed-badge');
const deployedPanelList = el('ide-deployed-panel-list');

// ─── User / Login (placeholder) ──────────────────────────────────────────────
function loadUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (raw) {
      const u = JSON.parse(raw);
      if (u && u.name) {
        accountGuest.hidden = true;
        accountUser.hidden = false;
        username.textContent = u.name;
        avatar.src = u.avatar || '';
        avatar.alt = u.name;
        if (!u.avatar) avatar.style.display = 'none';
        return;
      }
    }
  } catch (_) {}
  accountGuest.hidden = false;
  accountUser.hidden = true;
}

function login(provider) {
  // Placeholder: real OAuth would go here (e.g. Firebase, Auth0). For now demo.
  const name = provider === 'google' ? 'Google User' : 'GitHub User';
  const user = { provider, name, avatar: null };
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  loadUser();
  logConsole('Signed in as ' + name + ' (demo — use real OAuth in production).', 'dim');
}

function logout() {
  localStorage.removeItem(STORAGE_KEY_USER);
  loadUser();
  logConsole('Signed out.', 'dim');
}

el('ide-login-google')?.addEventListener('click', () => login('google'));
el('ide-login-github')?.addEventListener('click', () => login('github'));
el('ide-logout')?.addEventListener('click', logout);

// ─── File tree + tabs ──────────────────────────────────────────────────────
function getFileList() {
  return Object.keys(files).sort();
}

function renderFileTree() {
  const list = getFileList();
  fileTree.innerHTML = list.map((path) => {
    const id = path.replace(/\./g, '_');
    const isActive = path === (files[activeFileId] !== undefined ? activeFileId : DEFAULT_FILE);
    return `<div class="ide-file-item ${isActive ? 'active' : ''}" data-file="${escapeAttr(path)}" title="${escapeAttr(path)}">
      <span class="ide-file-miso-icon" aria-hidden="true"></span>
      <span>${escapeHtml(path)}</span>
    </div>`;
  }).join('');

  fileTree.querySelectorAll('.ide-file-item').forEach((node) => {
    node.addEventListener('click', () => switchToFile(node.dataset.file));
  });
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function switchToFile(path) {
  if (files[path] === undefined) return;
  activeFileId = path;
  editor.value = files[path];
  updateLineNumbers();
  renderFileTree();
  updateTabs();
}

function updateTabs() {
  const list = getFileList();
  tabs.innerHTML = list.map((path) => {
    const id = path.replace(/\./g, '_');
    const isActive = path === activeFileId;
    return `<div class="ide-tab ${isActive ? 'active' : ''}" data-id="${escapeAttr(path)}" id="ide-tab-${id}">
      <span class="ide-tab-icon ide-file-miso-icon"></span>
      <span class="ide-tab-label">${escapeHtml(path)}</span>
      <button type="button" class="ide-tab-close" data-id="${escapeAttr(path)}" aria-label="Close">×</button>
    </div>`;
  }).join('');

  tabs.querySelectorAll('.ide-tab').forEach((node) => {
    node.addEventListener('click', (e) => {
      if (!e.target.classList.contains('ide-tab-close')) switchToFile(node.dataset.id);
    });
  });
  tabs.querySelectorAll('.ide-tab-close').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeFile(btn.dataset.id);
    });
  });
}

function closeFile(path) {
  const list = getFileList();
  if (list.length <= 1) return;
  const idx = list.indexOf(path);
  delete files[path];
  saveFiles();
  activeFileId = list[idx + 1] ?? list[idx - 1];
  editor.value = files[activeFileId];
  renderFileTree();
  updateTabs();
  updateLineNumbers();
}

function newFile() {
  let name = 'contract.miso';
  let n = 0;
  while (files[name]) name = `contract_${++n}.miso`;
  files[name] = 'contract MyContract\n    x = 0\n\n    function get():\n        return x\n';
  saveFiles();
  activeFileId = name;
  editor.value = files[name];
  renderFileTree();
  updateTabs();
  updateLineNumbers();
  logConsole('Created ' + name, 'dim');
}

el('ide-new-file')?.addEventListener('click', newFile);

// ─── Editor ─────────────────────────────────────────────────────────────────
function updateLineNumbers() {
  const lines = (editor.value || '').split('\n').length;
  lineNums.textContent = Array.from({ length: Math.max(1, lines) }, (_, i) => i + 1).join('\n');
}

editor.addEventListener('input', () => {
  if (files[activeFileId] !== undefined) {
    files[activeFileId] = editor.value;
    saveFiles();
  }
  updateLineNumbers();
});
editor.addEventListener('scroll', () => { lineNums.scrollTop = editor.scrollTop; });

// ─── Output panels ─────────────────────────────────────────────────────────
document.querySelectorAll('.ide-output-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const panel = tab.dataset.panel;
    document.querySelectorAll('.ide-output-tab').forEach((t) => t.classList.toggle('active', t.dataset.panel === panel));
    document.querySelectorAll('.ide-output-panel').forEach((p) => {
      p.classList.toggle('active', p.id === 'ide-panel-' + panel);
    });
  });
});

function logConsole(msg, type = '') {
  const line = document.createElement('div');
  line.className = 'ide-console-line ' + type;
  line.textContent = msg;
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// ─── Compile ────────────────────────────────────────────────────────────────
function apiCompile(code) {
  return fetch('/api/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }).then((r) => r.json());
}

function apiRun(code, callFn) {
  return fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, callFn: callFn || null }),
  }).then((r) => r.json());
}

function doCompile() {
  const code = editor.value.trim();
  if (!code) {
    compilePre.innerHTML = '<code>Nothing to compile. Write a contract first.</code>';
    logConsole('Nothing to compile.', 'err');
    return;
  }
  compileBtn.disabled = true;
  compileBtn.textContent = 'Compiling…';
  apiCompile(code).then((body) => {
    compileBtn.disabled = false;
    compileBtn.innerHTML = '<span class="ide-btn-icon">▶</span> Compile';
    if (body.ok) {
      lastCompiled = { bytecode: body.bytecode, runtimeBytecode: body.runtimeBytecode, abi: body.abi, contractName: body.contractName };
      const bc = body.bytecode || '';
      const len = bc.startsWith('0x') ? (bc.length - 2) / 2 : 0;
      compilePre.innerHTML = `<code>Contract: ${escapeHtml(body.contractName)}
Bytecode (${len} bytes):
${escapeHtml(bc.slice(0, 200))}${bc.length > 200 ? '…' : ''}

ABI:
${escapeHtml(JSON.stringify(body.abi, null, 2).slice(0, 1500))}${(body.abi && JSON.stringify(body.abi).length > 1500) ? '…' : ''}</code>`;
      contractNameEl.textContent = body.contractName;
      const fns = (body.abi || []).filter((e) => e.type === 'function').map((e) => e.name);
      callFnSelect.innerHTML = '<option value="">— Select —</option>' + fns.map((f) => `<option value="${escapeAttr(f)}">${escapeHtml(f)}()</option>`).join('');
      callFnSelect.disabled = fns.length === 0;
      callBtn.disabled = fns.length === 0;
      logConsole('Compiled ' + body.contractName + ' (' + len + ' bytes)', 'ok');
    } else {
      lastCompiled = null;
      compilePre.innerHTML = '<code class="err">' + escapeHtml(body.error || 'Compile failed') + (body.line != null ? ' (line ' + body.line + ')' : '') + '</code>';
      contractNameEl.textContent = '—';
      callFnSelect.innerHTML = '<option value="">— Select —</option>';
      callFnSelect.disabled = true;
      callBtn.disabled = true;
      logConsole(body.error || 'Compile failed', 'err');
    }
  }).catch((e) => {
    compileBtn.disabled = false;
    compileBtn.innerHTML = '<span class="ide-btn-icon">▶</span> Compile';
    compilePre.innerHTML = '<code class="err">Network error: ' + escapeHtml(e.message) + '</code>';
    logConsole('Compile request failed: ' + e.message, 'err');
  });
}

function doRun() {
  const code = editor.value.trim();
  if (!code) {
    logConsole('Nothing to run.', 'err');
    return;
  }
  runBtn.disabled = true;
  runBtn.textContent = 'Running…';
  apiCompile(code).then((body) => {
    if (!body.ok) {
      runBtn.disabled = false;
      runBtn.innerHTML = '<span class="ide-btn-icon">▷</span> Run';
      logConsole('Compile failed: ' + (body.error || ''), 'err');
      return;
    }
    return apiRun(code, null).then((runBody) => {
      runBtn.disabled = false;
      runBtn.innerHTML = '<span class="ide-btn-icon">▷</span> Run';
      if (runBody.ok) {
        lastCompiled = { bytecode: body.bytecode, abi: body.abi, contractName: body.contractName };
        contractNameEl.textContent = runBody.contractName;
        const fns = (body.abi || []).filter((e) => e.type === 'function').map((e) => e.name);
        callFnSelect.innerHTML = '<option value="">— Select —</option>' + fns.map((f) => `<option value="${escapeAttr(f)}">${escapeHtml(f)}()</option>`).join('');
        callFnSelect.disabled = fns.length === 0;
        callBtn.disabled = fns.length === 0;
        callResultEl.textContent = 'Deployed. Runtime: ' + runBody.runtimeSize + ' bytes, gas: ' + runBody.deployGasUsed;
        callResultEl.className = 'ide-result ok';
        logConsole('Deployed ' + runBody.contractName + ' (runtime ' + runBody.runtimeSize + ' bytes)', 'ok');
      } else {
        callResultEl.textContent = runBody.error || 'Run failed';
        callResultEl.className = 'ide-result err';
        logConsole(runBody.error || 'Run failed', 'err');
      }
    });
  }).catch((e) => {
    runBtn.disabled = false;
    runBtn.innerHTML = '<span class="ide-btn-icon">▷</span> Run';
    logConsole('Run failed: ' + e.message, 'err');
  });
}

function doCall() {
  const fn = callFnSelect.value;
  if (!fn || !lastCompiled) return;
  const code = editor.value.trim();
  if (!code) return;
  callBtn.disabled = true;
  callResultEl.textContent = 'Executing…';
  apiRun(code, fn).then((body) => {
    callBtn.disabled = false;
    if (body.ok && body.callError == null) {
      callResultEl.textContent = (body.callResult != null ? body.callResult : '0x') + (body.callGasUsed != null ? ' (gas: ' + body.callGasUsed + ')' : '');
      callResultEl.className = 'ide-result ok';
      logConsole(fn + '() => ' + (body.callResult ?? '0x'), 'ok');
    } else {
      callResultEl.textContent = body.callError || body.error || 'Call failed';
      callResultEl.className = 'ide-result err';
      logConsole(fn + '() failed: ' + (body.callError || body.error), 'err');
    }
  }).catch((e) => {
    callBtn.disabled = false;
    callResultEl.textContent = e.message || 'Request failed';
    callResultEl.className = 'ide-result err';
    logConsole('Call failed: ' + e.message, 'err');
  });
}

function shortAddress(seed) {
  const hex = '0123456789abcdef';
  let s = '0x';
  for (let i = 0; i < 40; i++) s += hex[(seed + i * 7) % 16];
  return s.slice(0, 8) + '...' + s.slice(-4);
}

function formatCallResult(hex, outputType) {
  if (hex == null || hex === '') return '—';
  const h = (hex.replace(/^0x/, '') || '').padStart(64, '0');
  if ((outputType || '').toLowerCase() === 'string') {
    try {
      const full = hex.replace(/^0x/, '');
      const offset = parseInt(full.slice(0, 64), 16) * 2;
      const len = parseInt(full.slice(offset, offset + 64), 16);
      if (len > 0 && len < 2000) {
        const start = offset + 64;
        const raw = full.slice(start, start + len * 2);
        let str = '';
        for (let i = 0; i < raw.length; i += 2) str += String.fromCharCode(parseInt(raw.slice(i, i + 2), 16));
        return '0: string: "' + str.replace(/"/g, '\\"').replace(/\\/g, '\\\\') + '"';
      }
    } catch (_) {}
  }
  return '0: uint256: ' + (hex.length > 66 ? hex : hex);
}

function renderDeployed() {
  const count = deployedInstances.length;
  if (deployedBadge) deployedBadge.textContent = count;
  if (deployedEmpty) deployedEmpty.style.display = count ? 'none' : 'block';
  const container = deployedList;
  const panelContainer = deployedPanelList;
  if (!container && !panelContainer) return;
  if (count === 0) {
    if (container) container.innerHTML = '';
    if (panelContainer) panelContainer.innerHTML = '<p class="ide-deployed-empty">No deployed contracts. Compile then click Deploy.</p>';
    return;
  }

  function buildCardHtml(inst) {
    const fns = (inst.abi || []).filter((e) => e.type === 'function');
    const readFns = fns.filter((f) => (f.stateMutability || '').toLowerCase() === 'view' || (f.stateMutability || '').toLowerCase() === 'pure');
    const writeFns = fns.filter((f) => (f.stateMutability || '').toLowerCase() !== 'view' && (f.stateMutability || '').toLowerCase() !== 'pure');
    const nameUpper = (inst.contractName || 'CONTRACT').toUpperCase().replace(/\s/g, '');
    const addrUpper = (inst.address || '0x0').toUpperCase();
    const outType = (f) => ((f.outputs || [])[0] || {}).type || 'uint256';
    let html = `
      <div class="ide-deployed-card" data-inst-id="${inst.id}">
        <div class="ide-deployed-card-header" data-toggle>
          <span class="ide-deployed-card-chevron">▼</span>
          <span class="ide-deployed-card-name">${escapeHtml(nameUpper)} AT ${escapeHtml(addrUpper)}:</span>
          <div class="ide-deployed-card-actions">
            <button type="button" class="ide-icon-btn" title="Copy address" data-copy="${escapeAttr(inst.address)}">⎘</button>
            <button type="button" class="ide-icon-btn ide-pin" title="Pin" data-pin="${inst.id}">📌</button>
            <button type="button" class="ide-icon-btn" title="Remove" data-remove="${inst.id}">×</button>
          </div>
        </div>
        <div class="ide-deployed-card-body">
        <div class="ide-deployed-balance">Balance: 0 ETH</div>`;
    readFns.forEach((f) => {
      const retType = outType(f);
      html += `
        <div class="ide-deployed-fn" data-fn="${escapeAttr(f.name)}" data-inst-id="${inst.id}" data-output-type="${escapeAttr(retType)}">
          <div class="ide-deployed-fn-row">
            <button type="button" class="ide-deployed-fn-btn read">${escapeHtml(f.name)}</button>
          </div>
          <div class="ide-deployed-fn-result" data-result></div>
        </div>`;
    });
    writeFns.forEach((f) => {
      const ph = ((f.inputs || [])[0] || {}).name || 'value';
      html += `
        <div class="ide-deployed-fn" data-fn="${escapeAttr(f.name)}" data-inst-id="${inst.id}" data-write="1">
          <div class="ide-deployed-fn-row">
            <button type="button" class="ide-deployed-fn-btn write">${escapeHtml(f.name)}</button>
            <span class="ide-deployed-fn-input-wrap"><input class="ide-deployed-fn-input" type="text" placeholder="${escapeAttr(ph)}" data-input /></span>
          </div>
          <div class="ide-deployed-fn-result" data-result></div>
        </div>`;
    });
    html += '</div></div>';
    return html;
  }

  const cardsHtml = deployedInstances.map((inst) => buildCardHtml(inst)).join('');
  if (container) {
    container.innerHTML = count ? cardsHtml : '';
    container.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigator.clipboard?.writeText(btn.dataset.copy);
        logConsole('Address copied', 'dim');
      });
    });
    container.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        deployedInstances = deployedInstances.filter((i) => String(i.id) !== String(btn.dataset.remove));
        renderDeployed();
        logConsole('Instance removed', 'dim');
      });
    });
    container.querySelectorAll('[data-toggle]').forEach((el) => {
      el.addEventListener('click', () => {
        const card = el.closest('.ide-deployed-card');
        if (card) card.classList.toggle('collapsed');
      });
    });
    container.querySelectorAll('.ide-deployed-fn-btn.read').forEach((btn) => {
      const fn = btn.closest('.ide-deployed-fn');
      if (!fn) return;
      const instId = fn.dataset.instId;
      const fnName = fn.dataset.fn;
      const outputType = fn.dataset.outputType || 'uint256';
      const inst = deployedInstances.find((i) => String(i.id) === instId);
      if (!inst) return;
      btn.addEventListener('click', () => {
        const resultEl = fn.querySelector('[data-result]');
        if (resultEl) { resultEl.textContent = '…'; resultEl.classList.remove('err'); }
        apiRun(inst.code, fnName).then((body) => {
          if (resultEl) {
            if (body.ok && body.callError == null) {
              resultEl.textContent = formatCallResult(body.callResult, outputType);
            } else {
              resultEl.textContent = body.callError || body.error || 'failed';
              resultEl.classList.add('err');
            }
          }
          if (body.ok && !body.callError) logConsole(fnName + '() => ' + (body.callResult ?? '0x'), 'ok');
          else logConsole(fnName + '() failed: ' + (body.callError || body.error), 'err');
        });
      });
    });
    container.querySelectorAll('.ide-deployed-fn-btn.write').forEach((btn) => {
      const fn = btn.closest('.ide-deployed-fn');
      if (!fn) return;
      const instId = fn.dataset.instId;
      const fnName = fn.dataset.fn;
      const inst = deployedInstances.find((i) => String(i.id) === instId);
      if (!inst) return;
      btn.addEventListener('click', () => {
        const resultEl = fn.querySelector('[data-result]');
        if (resultEl) { resultEl.textContent = '…'; resultEl.classList.remove('err'); }
        apiRun(inst.code, fnName).then((body) => {
          if (resultEl) {
            if (body.ok && !body.callError) resultEl.textContent = 'OK (simulated — state not persisted)';
            else { resultEl.textContent = body.callError || body.error || 'failed'; resultEl.classList.add('err'); }
          }
          if (body.ok && !body.callError) logConsole(fnName + '() simulated', 'dim');
          else logConsole(fnName + '() failed: ' + (body.callError || body.error), 'err');
        });
      });
    });
  }
  if (panelContainer) {
    panelContainer.innerHTML = count ? cardsHtml : '<p class="ide-deployed-empty">No deployed contracts. Compile then click Deploy.</p>';
    panelContainer.querySelectorAll('[data-toggle]').forEach((el) => {
      el.addEventListener('click', () => { const c = el.closest('.ide-deployed-card'); if (c) c.classList.toggle('collapsed'); });
    });
    panelContainer.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => navigator.clipboard?.writeText(btn.dataset.copy));
    });
    panelContainer.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        deployedInstances = deployedInstances.filter((i) => String(i.id) !== String(btn.dataset.remove));
        renderDeployed();
      });
    });
    panelContainer.querySelectorAll('.ide-deployed-fn-btn.read').forEach((btn) => {
      const fn = btn.closest('.ide-deployed-fn');
      if (!fn) return;
      const instId = fn.dataset.instId;
      const fnName = fn.dataset.fn;
      const outputType = fn.dataset.outputType || 'uint256';
      const inst = deployedInstances.find((i) => String(i.id) === instId);
      if (!inst) return;
      btn.addEventListener('click', () => {
        const resultEl = fn.querySelector('[data-result]');
        if (resultEl) { resultEl.textContent = '…'; resultEl.classList.remove('err'); }
        apiRun(inst.code, fnName).then((body) => {
          if (resultEl) {
            if (body.ok && body.callError == null) resultEl.textContent = formatCallResult(body.callResult, outputType);
            else { resultEl.textContent = body.callError || body.error || 'failed'; resultEl.classList.add('err'); }
          }
        });
      });
    });
    panelContainer.querySelectorAll('.ide-deployed-fn-btn.write').forEach((btn) => {
      const fn = btn.closest('.ide-deployed-fn');
      if (!fn) return;
      const instId = fn.dataset.instId;
      const fnName = fn.dataset.fn;
      const inst = deployedInstances.find((i) => String(i.id) === instId);
      if (!inst) return;
      btn.addEventListener('click', () => {
        const resultEl = fn.querySelector('[data-result]');
        if (resultEl) { resultEl.textContent = '…'; resultEl.classList.remove('err'); }
        apiRun(inst.code, fnName).then((body) => {
          if (resultEl) {
            if (body.ok && !body.callError) resultEl.textContent = 'OK (simulated)';
            else { resultEl.textContent = body.callError || body.error || 'failed'; resultEl.classList.add('err'); }
          }
        });
      });
    });
  }
}

function doDeploy() {
  const code = editor.value.trim();
  if (!code) {
    logConsole('Nothing to deploy.', 'err');
    return;
  }
  deployBtn.disabled = true;
  deployBtn.textContent = 'Deploying…';
  apiCompile(code).then((body) => {
    if (!body.ok) {
      deployBtn.disabled = false;
      deployBtn.innerHTML = '<span class="ide-btn-icon">⬆</span> Deploy';
      logConsole('Compile failed: ' + (body.error || ''), 'err');
      return;
    }
    return apiRun(code, null).then((runBody) => {
      deployBtn.disabled = false;
      deployBtn.innerHTML = '<span class="ide-btn-icon">⬆</span> Deploy';
      if (runBody.ok) {
        const id = deployIdNext++;
        const address = shortAddress(id + Date.now());
        deployedInstances.push({
          id,
          contractName: body.contractName,
          address,
          abi: body.abi,
          code,
        });
        renderDeployed();
        document.querySelectorAll('.ide-output-tab').forEach((t) => t.classList.toggle('active', t.dataset.panel === 'deployed'));
        document.querySelectorAll('.ide-output-panel').forEach((p) => p.classList.toggle('active', p.id === 'ide-panel-deployed'));
        logConsole('Deployed ' + body.contractName + ' at ' + address, 'ok');
      } else {
        logConsole('Deploy failed: ' + (runBody.error || ''), 'err');
      }
    });
  }).catch((e) => {
    deployBtn.disabled = false;
    deployBtn.innerHTML = '<span class="ide-btn-icon">⬆</span> Deploy';
    logConsole('Deploy failed: ' + e.message, 'err');
  });
}

el('ide-deploy-btn')?.addEventListener('click', doDeploy);
el('ide-deployed-clear')?.addEventListener('click', () => {
  deployedInstances = [];
  renderDeployed();
  logConsole('Cleared deployed contracts.', 'dim');
});

compileBtn?.addEventListener('click', doCompile);
runBtn?.addEventListener('click', doRun);
callBtn?.addEventListener('click', doCall);

// ─── Init ──────────────────────────────────────────────────────────────────
loadUser();
loadFiles();
switchToFile(activeFileId in files ? activeFileId : DEFAULT_FILE);
updateTabs();
updateLineNumbers();
