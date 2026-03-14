/* ══════════════════════════════════════════════
   MISOLTAV WEBSITE — app.js
   Three.js hero · Tabs · Scroll FX
   ══════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────
   1. DATA
   ────────────────────────────────────────────── */

const COMPARISONS = [
  {
    label: 'Contract',
    sol: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Token {
    address public owner;
    mapping(address => uint256) public balance;

    constructor() {
        owner = msg.sender;
    }
}`,
    miso: `contract Token
    owner   = sender
    balance[address]`,
    solLines: 10, misoLines: 3,
  },
  {
    label: 'Mint',
    sol: `modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}

function mint(address user, uint256 amount)
    public onlyOwner
{
    balance[user] += amount;
}`,
    miso: `function mint(user, amount):
    only owner
    balance[user] += amount`,
    solLines: 10, misoLines: 3,
  },
  {
    label: 'Transfer',
    sol: `function transfer(
    address to,
    uint256 amount
) public returns (bool) {
    require(
        balance[msg.sender] >= amount,
        "Insufficient balance"
    );
    balance[msg.sender] -= amount;
    balance[to] += amount;
    return true;
}`,
    miso: `function transfer(to, amount):
    require balance[sender] >= amount
    balance[sender] -= amount
    balance[to] += amount`,
    solLines: 12, misoLines: 4,
  },
  {
    label: 'Withdraw',
    sol: `bool private locked;
modifier nonReentrant() {
    require(!locked, "Reentrant call");
    locked = true;
    _;
    locked = false;
}

function withdraw(uint256 amount)
    public nonReentrant
{
    require(balance[msg.sender] >= amount);
    balance[msg.sender] -= amount;
    payable(msg.sender).transfer(amount);
}`,
    miso: `function withdraw(amount):
    lock
    require balance[sender] >= amount
    balance[sender] -= amount
    send(sender, amount)`,
    solLines: 16, misoLines: 5,
  },
  {
    label: 'Events',
    sol: `event Transfer(
    address indexed from,
    address indexed to,
    uint256 value
);

emit Transfer(msg.sender, recipient, amount);`,
    miso: `event Transfer(from, to, value)

emit Transfer(
    from: sender,
    to: recipient,
    value: amount
)`,
    solLines: 7, misoLines: 7,
  },
  {
    label: 'Payable',
    sol: `function deposit() public payable {
    require(
        msg.value > 0,
        "Send some ETH"
    );
    balance[msg.sender] += msg.value;
}`,
    miso: `function deposit():
    payable
    balance[sender] += value`,
    solLines: 7, misoLines: 3,
  },
];

const EXAMPLES = [
  {
    title: 'ERC-20 Style Token',
    filename: 'Token.miso',
    desc: 'A fully functional fungible token with mint, burn, transfer, and approval — in fewer than 40 lines with no imports.',
    features: ['Mint & burn with owner guard', 'Transfer with balance check', 'Allowance & transferFrom', 'Auto-safe arithmetic'],
    code: `contract Token
    owner   = sender
    name    = "MisoToken"
    symbol  = "MISO"
    supply  = 0

    balance[address]
    allowance[address][address]

    event Transfer(from, to, amount)
    event Approval(owner, spender, amount)

    function mint(user, amount):
        only owner
        balance[user] += amount
        supply += amount
        emit Transfer(from: self, to: user, amount: amount)

    function transfer(to, amount):
        require balance[sender] >= amount
        balance[sender] -= amount
        balance[to] += amount
        emit Transfer(from: sender, to: to, amount: amount)

    function approve(spender, amount):
        allowance[sender][spender] = amount
        emit Approval(owner: sender, spender: spender, amount: amount)

    function transferFrom(from, to, amount):
        require allowance[from][sender] >= amount
        require balance[from] >= amount
        allowance[from][sender] -= amount
        balance[from] -= amount
        balance[to] += amount
        emit Transfer(from: from, to: to, amount: amount)

    function burn(amount):
        require balance[sender] >= amount
        balance[sender] -= amount
        supply -= amount`,
  },
  {
    title: 'DAO Voting',
    filename: 'Voting.miso',
    desc: 'Governance voting with an admin-controlled proposal list, one-vote-per-address enforcement, and a winner query.',
    features: ['Admin-only proposal creation', 'Vote once per address', 'Proposal struct with voteCount', 'Live winner query'],
    code: `contract Voting
    admin = sender
    count = 0

    proposals[address]
    hasVoted[address]

    event Voted(voter, proposal)

    struct Proposal:
        id
        description
        voteCount

    function addProposal(description):
        only admin
        proposals[count] = Proposal(
            id: count,
            description: description,
            voteCount: 0
        )
        count += 1

    function vote(proposalId):
        require not hasVoted[sender], "Already voted"
        require proposalId < count,   "Invalid proposal"
        proposals[proposalId].voteCount += 1
        hasVoted[sender] = true
        emit Voted(voter: sender, proposal: proposalId)

    function getVoteCount(proposalId):
        return proposals[proposalId].voteCount`,
  },
  {
    title: 'Crowdfunding',
    filename: 'Crowdfunding.miso',
    desc: 'A time-bounded crowdfunding campaign with Ether contributions, automatic goal detection, admin withdrawal, and backer refunds.',
    features: ['payable contributions', 'Automatic goal tracking', 'Reentrancy-safe withdrawal', 'Full backer refund logic'],
    code: `contract Crowdfunding
    admin    = sender
    goal     = 0
    deadline = 0
    raised   = 0

    enum Status:
        Active
        Successful
        Failed

    status    = Status.Active
    backers[address]

    event Contributed(backer, amount)
    event GoalReached(total)
    event Refunded(backer, amount)

    function init(goalAmount, durationDays):
        only admin
        goal     = goalAmount
        deadline = now + durationDays * 1 days

    function contribute():
        payable
        require now < deadline,           "Campaign ended"
        require status == Status.Active,  "Not active"
        backers[sender] += value
        raised += value
        emit Contributed(backer: sender, amount: value)
        if raised >= goal:
            status = Status.Successful
            emit GoalReached(total: raised)

    function withdraw():
        lock
        only admin
        require status == Status.Successful
        send(admin, raised)
        raised = 0

    function refund():
        lock
        require now >= deadline
        require status != Status.Successful
        amount = backers[sender]
        require amount > 0, "Nothing to refund"
        backers[sender] = 0
        send(sender, amount)
        emit Refunded(backer: sender, amount: amount)`,
  },
  {
    title: 'NFT Collection',
    filename: 'SimpleNFT.miso',
    desc: 'A simple ERC-721 style NFT contract. Admin mints with a custom URI; owners can transfer tokens.',
    features: ['Admin-only mint', 'Per-token URI storage', 'Ownership mapping', 'Transfer with ownership check'],
    code: `contract SimpleNFT
    admin   = sender
    nextId  = 0

    ownerOf[address]
    tokenURI[address]

    event Minted(to, tokenId, uri)
    event Transferred(from, to, tokenId)

    function mint(to, uri):
        only admin
        tokenId = nextId
        nextId += 1
        ownerOf[tokenId] = to
        tokenURI[tokenId] = uri
        emit Minted(to: to, tokenId: tokenId, uri: uri)

    function transfer(to, tokenId):
        require ownerOf[tokenId] == sender, "Not owner"
        ownerOf[tokenId] = to
        emit Transferred(from: sender, to: to, tokenId: tokenId)

    function getOwner(tokenId):
        return ownerOf[tokenId]

    function getURI(tokenId):
        return tokenURI[tokenId]`,
  },
  {
    title: 'Escrow',
    filename: 'Escrow.miso',
    desc: 'A two-party escrow where a buyer locks funds and either releases to the seller or gets a refund — with reentrancy protection.',
    features: ['Buyer deposits ETH', 'Reentrancy-safe release & refund', 'Enum state machine', 'Seller set by buyer'],
    code: `contract Escrow
    buyer  = sender
    seller = 0x0000000000000000000000000000000000000000
    amount = 0

    enum State:
        Awaiting
        Complete
        Refunded

    state = State.Awaiting

    event Released(to, amount)
    event Refunded(to, amount)

    function setSeller(addr):
        only buyer
        seller = addr

    function deposit():
        payable
        only buyer
        require state == State.Awaiting
        amount = value

    function release():
        lock
        only buyer
        require state == State.Awaiting
        state = State.Complete
        send(seller, amount)
        emit Released(to: seller, amount: amount)

    function refundBuyer():
        lock
        only seller
        require state == State.Awaiting
        state = State.Refunded
        send(buyer, amount)
        emit Refunded(to: buyer, amount: amount)`,
  },
  {
    title: 'Hello World',
    filename: 'HelloWorld.miso',
    desc: 'The simplest possible Misoltav contract — store a string and return it. Perfect as a first contract.',
    features: ['Immutable greeting string', 'Public read function', 'Zero boilerplate', 'Fewer than 5 lines'],
    code: `contract HelloWorld
    greeting = "Hello, Misoltav!"

    function getGreeting():
        return greeting`,
  },
];

/* ──────────────────────────────────────────────
   2. SYNTAX HIGHLIGHTER
   ────────────────────────────────────────────── */
const KEYWORDS = ['contract','function','only','lock','payable','require',
  'return','emit','revert','send','if','elif','else','match','for','in',
  'while','not','and','or','struct','enum','event','import','from','true',
  'false','self'];
const SOLIDITY_KW = ['pragma','solidity','contract','function','modifier',
  'constructor','public','private','require','emit','returns','payable',
  'bool','address','uint256','uint8','string','mapping','memory','view',
  'pure','return','if','else','for','while','event','indexed','true','false'];

function highlightMiso(code) {
  return code.split('\n').map(line => {
    // Comments
    if (line.trimStart().startsWith('--')) {
      return `<span class="cm">${esc(line)}</span>`;
    }
    let out = '';
    let i = 0;
    while (i < line.length) {
      // String
      if (line[i] === '"') {
        let j = i + 1;
        while (j < line.length && line[j] !== '"') j++;
        out += `<span class="str">${esc(line.slice(i, j+1))}</span>`;
        i = j + 1; continue;
      }
      // Number
      if (/[0-9]/.test(line[i])) {
        let j = i;
        while (j < line.length && /[0-9._]/.test(line[j])) j++;
        out += `<span class="num">${esc(line.slice(i, j))}</span>`;
        i = j; continue;
      }
      // Identifier / keyword
      if (/[a-zA-Z_]/.test(line[i])) {
        let j = i;
        while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
        const word = line.slice(i, j);
        if (KEYWORDS.includes(word)) {
          out += `<span class="kw">${esc(word)}</span>`;
        } else if (word[0] === word[0].toUpperCase() && word.length > 1) {
          out += `<span class="ev">${esc(word)}</span>`;
        } else {
          out += esc(word);
        }
        i = j; continue;
      }
      out += esc(line[i]);
      i++;
    }
    return out;
  }).join('\n');
}

function highlightSolidity(code) {
  return code.split('\n').map(line => {
    if (line.trimStart().startsWith('//')) {
      return `<span class="cm">${esc(line)}</span>`;
    }
    let out = '';
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let j = i + 1;
        while (j < line.length && line[j] !== '"') j++;
        out += `<span class="str">${esc(line.slice(i, j+1))}</span>`;
        i = j + 1; continue;
      }
      if (/[0-9]/.test(line[i])) {
        let j = i;
        while (j < line.length && /[0-9._x]/.test(line[j])) j++;
        out += `<span class="num">${esc(line.slice(i,j))}</span>`;
        i = j; continue;
      }
      if (/[a-zA-Z_]/.test(line[i])) {
        let j = i;
        while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
        const word = line.slice(i, j);
        if (SOLIDITY_KW.includes(word)) {
          out += `<span class="kw">${esc(word)}</span>`;
        } else {
          out += esc(word);
        }
        i = j; continue;
      }
      out += esc(line[i]);
      i++;
    }
    return out;
  }).join('\n');
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ──────────────────────────────────────────────
   3. THREE.JS HERO 3D SCENE
   ────────────────────────────────────────────── */
function initHeroScene() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, canvas.offsetWidth / canvas.offsetHeight, 0.1, 200);
  camera.position.set(0, 0, 30);

  // ── Lights ──
  const ambientLight = new THREE.AmbientLight(0x1a0540, 3);
  scene.add(ambientLight);
  const pointLight1 = new THREE.PointLight(0x8b5cf6, 200, 80);
  pointLight1.position.set(-15, 10, 10);
  scene.add(pointLight1);
  const pointLight2 = new THREE.PointLight(0x22d3ee, 150, 80);
  pointLight2.position.set(15, -10, 10);
  scene.add(pointLight2);
  const pointLight3 = new THREE.PointLight(0x10b981, 80, 60);
  pointLight3.position.set(0, 20, -5);
  scene.add(pointLight3);

  // ── Central Hexagonal Prism (Misoltav logo-ish) ──
  const hexGeo = new THREE.CylinderGeometry(4, 4, 1.2, 6, 1);
  const hexMat = new THREE.MeshStandardMaterial({
    color: 0x8b5cf6,
    metalness: 0.9,
    roughness: 0.1,
    emissive: 0x4c1d95,
    emissiveIntensity: 0.4,
  });
  const hexMesh = new THREE.Mesh(hexGeo, hexMat);
  hexMesh.rotation.x = Math.PI / 6;
  scene.add(hexMesh);

  // ── Wireframe outer hex ──
  const hexWireGeo = new THREE.CylinderGeometry(5.5, 5.5, 0.2, 6, 1);
  const hexWireMat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, wireframe: true, transparent: true, opacity: 0.35 });
  const hexWire = new THREE.Mesh(hexWireGeo, hexWireMat);
  scene.add(hexWire);

  // ── Orbiting spheres ──
  const orbitGroup = new THREE.Group();
  scene.add(orbitGroup);
  const orbitColors = [0x22d3ee, 0x8b5cf6, 0x10b981, 0xf59e0b, 0xf43f5e];
  const orbitSpheres = [];
  orbitColors.forEach((color, i) => {
    const angle = (i / orbitColors.length) * Math.PI * 2;
    const radius = 10 + (i % 2) * 3;
    const geo = new THREE.SphereGeometry(0.5 + (i % 3) * 0.2, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.8,
      roughness: 0.2,
      emissive: color,
      emissiveIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * 4, Math.sin(angle) * radius * 0.3);
    orbitGroup.add(mesh);
    orbitSpheres.push({ mesh, angle, radius, speed: 0.003 + i * 0.0008, yOff: i });
  });

  // ── Floating particles ──
  const particleCount = 700;
  const positions = new Float32Array(particleCount * 3);
  const pColors   = new Float32Array(particleCount * 3);
  const palette   = [
    new THREE.Color(0x8b5cf6),
    new THREE.Color(0x22d3ee),
    new THREE.Color(0x10b981),
    new THREE.Color(0xffffff),
  ];
  for (let i = 0; i < particleCount; i++) {
    positions[i*3]   = (Math.random() - 0.5) * 120;
    positions[i*3+1] = (Math.random() - 0.5) * 80;
    positions[i*3+2] = (Math.random() - 0.5) * 60 - 20;
    const c = palette[Math.floor(Math.random() * palette.length)];
    pColors[i*3] = c.r; pColors[i*3+1] = c.g; pColors[i*3+2] = c.b;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('color',    new THREE.BufferAttribute(pColors, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.18,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // ── Ring ──
  const ringGeo = new THREE.TorusGeometry(8, 0.06, 8, 120);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2.5;
  scene.add(ring);

  // ── Second ring ──
  const ring2Geo = new THREE.TorusGeometry(12, 0.04, 8, 160);
  const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.15 });
  const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
  ring2.rotation.x = Math.PI / 4;
  ring2.rotation.y = Math.PI / 6;
  scene.add(ring2);

  // ── Mouse parallax ──
  let mouse = { x: 0, y: 0 };
  document.addEventListener('mousemove', e => {
    mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // ── Resize ──
  const onResize = () => {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  // ── Animation loop ──
  let t = 0;
  const animate = () => {
    requestAnimationFrame(animate);
    t += 0.008;

    // Hex spin
    hexMesh.rotation.y = t * 0.4;
    hexMesh.position.y = Math.sin(t * 0.7) * 0.5;
    hexWire.rotation.y = -t * 0.3;

    // Orbiting spheres
    orbitSpheres.forEach((o, i) => {
      o.angle += o.speed;
      o.mesh.position.x = Math.cos(o.angle) * o.radius;
      o.mesh.position.y = Math.sin(o.angle * 0.5 + o.yOff) * 3;
      o.mesh.position.z = Math.sin(o.angle) * o.radius * 0.3;
    });

    // Orbit group tilt follows mouse
    orbitGroup.rotation.x += (mouse.y * 0.3 - orbitGroup.rotation.x) * 0.04;
    orbitGroup.rotation.y += (mouse.x * 0.5 - orbitGroup.rotation.y) * 0.04;

    // Particles drift
    particles.rotation.y = t * 0.02;
    particles.rotation.x = t * 0.01;

    // Rings rotate
    ring.rotation.z  = t * 0.15;
    ring2.rotation.z = -t * 0.1;

    // Camera subtle drift
    camera.position.x += (mouse.x * 3 - camera.position.x) * 0.03;
    camera.position.y += (-mouse.y * 2 - camera.position.y) * 0.03;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  };
  animate();
}

/* ──────────────────────────────────────────────
   4. COMPARISON TABS
   ────────────────────────────────────────────── */
function initCompareTabs() {
  const tabs    = document.querySelectorAll('#compare-tabs .tab');
  const solEl   = document.querySelector('#sol-code code');
  const misoEl  = document.querySelector('#miso-code code');
  const statEl  = document.getElementById('compare-stat');
  if (!tabs.length || !solEl || !misoEl) return;

  function show(idx) {
    const c = COMPARISONS[idx];
    solEl.innerHTML  = highlightSolidity(c.sol);
    misoEl.innerHTML = highlightMiso(c.miso);
    const reduction  = Math.round((1 - c.misoLines / c.solLines) * 100);
    statEl.textContent = reduction > 0 ? `↓ ${reduction}% fewer lines` : 'Comparable';
    tabs.forEach(t => { t.classList.toggle('active', +t.dataset.tab === idx); t.setAttribute('aria-selected', +t.dataset.tab === idx); });
  }

  tabs.forEach(t => t.addEventListener('click', () => show(+t.dataset.tab)));
  show(0);
}

/* ──────────────────────────────────────────────
   6. EXAMPLES TABS
   ────────────────────────────────────────────── */
function initExamples() {
  const tabs     = document.querySelectorAll('#examples-selector .ex-tab');
  const codeEl   = document.querySelector('#ex-code-display code');
  const fnEl     = document.getElementById('ex-filename');
  const titleEl  = document.getElementById('ex-title');
  const bodyEl   = document.getElementById('ex-body');
  const featEl   = document.getElementById('ex-features');
  const copyBtn  = document.getElementById('copy-btn');
  if (!tabs.length) return;

  let currentCode = '';

  function show(idx) {
    const ex = EXAMPLES[idx];
    currentCode = ex.code;
    codeEl.innerHTML  = highlightMiso(ex.code);
    fnEl.textContent  = ex.filename;
    titleEl.textContent = ex.title;
    bodyEl.textContent  = ex.desc;
    featEl.innerHTML  = ex.features.map(f => `<li>${f}</li>`).join('');
    tabs.forEach(t => { t.classList.toggle('active', +t.dataset.ex === idx); });
  }

  tabs.forEach(t => t.addEventListener('click', () => show(+t.dataset.ex)));

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentCode).then(() => {
      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 2000);
    });
  });

  show(0);
}

/* ──────────────────────────────────────────────
   7. INTERSECTION OBSERVER — SCROLL ANIMATIONS
   ────────────────────────────────────────────── */
function initScrollAnimations() {
  const targets = document.querySelectorAll(
    '.pillar-card, .feature-card, .arch-step, .uc-card, .rm-item'
  );
  const delays = {
    'pillar-card':  [0, 0.15, 0.3],
    'feature-card': [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56],
    'arch-step':    [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56],
    'uc-card':      Array.from({length:10}, (_,i) => i * 0.05),
    'rm-item':      Array.from({length:10}, (_,i) => i * 0.06),
  };

  const grouped = {};
  targets.forEach(el => {
    const cls = [...el.classList].find(c => delays[c]);
    if (!cls) return;
    if (!grouped[cls]) grouped[cls] = [];
    grouped[cls].push(el);
  });

  Object.entries(grouped).forEach(([cls, els]) => {
    els.forEach((el, i) => {
      el.style.animationDelay = (delays[cls][i] || 0) + 's';
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  targets.forEach(el => observer.observe(el));
}

/* ──────────────────────────────────────────────
   8. NAV SCROLL + HAMBURGER
   ────────────────────────────────────────────── */
function initNav() {
  const nav = document.getElementById('nav');
  const ham = document.getElementById('hamburger');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  });

  ham?.addEventListener('click', () => {
    const open = nav.classList.toggle('menu-open');
    ham.setAttribute('aria-expanded', open);
  });

  // Close menu on link click
  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => nav.classList.remove('menu-open'));
  });
}

/* ──────────────────────────────────────────────
   9. INIT
   ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initHeroScene();
  initCompareTabs();
  initExamples();
  initScrollAnimations();
  initGrammarTabs();
  initParadigmAnimations();
  initReference();
  initPlayground();
});

/* ──────────────────────────────────────────────
   10. BNF + EBNF GRAMMAR DATA
   ────────────────────────────────────────────── */

const BNF_DATA = {
  'bnf-prog': `<program>         ::= { <import-stmt> } { <top-level-decl> }

<import-stmt>     ::= "import" IDENTIFIER
                    | "import" IDENTIFIER "from" STRING

<top-level-decl>  ::= <contract-decl>
                    | <interface-decl>
                    | <struct-decl>
                    | <enum-decl>`,

  'bnf-contract': `<contract-decl>   ::= "contract" IDENTIFIER NEWLINE INDENT
                        <contract-body>
                      DEDENT

<contract-body>   ::= { <state-decl> | <event-decl> | <fn-decl> }

<state-decl>      ::= IDENTIFIER "=" <expression> NEWLINE
                    | IDENTIFIER "[" IDENTIFIER "]" NEWLINE
                    | IDENTIFIER "[" IDENTIFIER "]" "[" IDENTIFIER "]" NEWLINE

<event-decl>      ::= "event" IDENTIFIER "(" <id-list-opt> ")" NEWLINE

<interface-decl>  ::= "interface" IDENTIFIER ":" NEWLINE
                        INDENT { <fn-signature> } DEDENT

<struct-decl>     ::= "struct" IDENTIFIER ":" NEWLINE
                        INDENT { IDENTIFIER NEWLINE } DEDENT

<enum-decl>       ::= "enum" IDENTIFIER ":" NEWLINE
                        INDENT { IDENTIFIER NEWLINE } DEDENT

<param-list-opt>  ::= <param-list> | ε
<param-list>      ::= IDENTIFIER { "," IDENTIFIER }

<id-list-opt>     ::= IDENTIFIER { "," IDENTIFIER } | ε`,

  'bnf-fn': `<fn-decl>         ::= "function" IDENTIFIER "(" <param-list-opt> ")" ":" NEWLINE
                        INDENT <fn-body> DEDENT

<fn-body>         ::= { <guard-stmt> | <statement> }

<guard-stmt>      ::= "only" <expression> NEWLINE
                    | "lock" NEWLINE
                    | "payable" NEWLINE

<fn-signature>    ::= "function" IDENTIFIER "(" <param-list-opt> ")" NEWLINE`,

  'bnf-stmts': `<statement>       ::= <assign-stmt>
                    | <aug-assign-stmt>
                    | <if-stmt>
                    | <match-stmt>
                    | <for-stmt>
                    | <while-stmt>
                    | <return-stmt>
                    | <emit-stmt>
                    | <require-stmt>
                    | <revert-stmt>
                    | <send-stmt>
                    | <expr-stmt>

<assign-stmt>     ::= <lvalue> "=" <expression> NEWLINE

<aug-assign-stmt> ::= <lvalue> "+=" <expression> NEWLINE
                    | <lvalue> "-=" <expression> NEWLINE
                    | <lvalue> "*=" <expression> NEWLINE
                    | <lvalue> "/=" <expression> NEWLINE

<lvalue>          ::= IDENTIFIER
                    | IDENTIFIER "[" <expression> "]"
                    | IDENTIFIER "[" <expression> "]" "[" <expression> "]"
                    | IDENTIFIER "." IDENTIFIER

<if-stmt>         ::= "if" <expression> ":" NEWLINE INDENT <stmt-list> DEDENT
                       { "elif" <expression> ":" NEWLINE INDENT <stmt-list> DEDENT }
                       [ "else" ":" NEWLINE INDENT <stmt-list> DEDENT ]

<match-stmt>      ::= "match" <expression> ":" NEWLINE
                        INDENT { <match-arm> } DEDENT

<match-arm>       ::= IDENTIFIER ":" NEWLINE INDENT <stmt-list> DEDENT

<for-stmt>        ::= "for" IDENTIFIER "in" <expression> ":" NEWLINE
                        INDENT <stmt-list> DEDENT

<while-stmt>      ::= "while" <expression> ":" NEWLINE
                        INDENT <stmt-list> DEDENT

<return-stmt>     ::= "return" [ <expression> ] NEWLINE
<emit-stmt>       ::= "emit" IDENTIFIER "(" <named-arg-list-opt> ")" NEWLINE
<require-stmt>    ::= "require" <expression> NEWLINE
                    | "require" <expression> "," STRING NEWLINE
<revert-stmt>     ::= "revert" STRING NEWLINE
<send-stmt>       ::= "send" "(" <expression> "," <expression> ")" NEWLINE
<expr-stmt>       ::= <expression> NEWLINE
<stmt-list>       ::= { <statement> }`,

  'bnf-exprs': `<expression>      ::= <or-expr>
<or-expr>         ::= <and-expr> { "or" <and-expr> }
<and-expr>        ::= <not-expr> { "and" <not-expr> }
<not-expr>        ::= [ "not" ] <cmp-expr>
<cmp-expr>        ::= <add-expr> { <cmp-op> <add-expr> }
<cmp-op>          ::= "==" | "!=" | "<" | ">" | "<=" | ">="
<add-expr>        ::= <mul-expr> { ( "+" | "-" ) <mul-expr> }
<mul-expr>        ::= <unary-expr> { ( "*" | "/" | "%" ) <unary-expr> }
<unary-expr>      ::= [ "-" ] <postfix-expr>
<postfix-expr>    ::= <primary> { <subscript> | <attribute> | <call> }
<subscript>       ::= "[" <expression> "]"
<attribute>       ::= "." IDENTIFIER
<call>            ::= "(" [ <arg-list> ] ")"
<primary>         ::= LITERAL | IDENTIFIER | "(" <expression> ")"

<named-arg-list-opt> ::= <named-arg> { "," <named-arg> } | ε
<named-arg>          ::= IDENTIFIER ":" <expression>
<arg-list>           ::= <expression> { "," <expression> }`,

  'bnf-terminals': `LITERAL    ::= NUMBER | STRING | BOOL | ADDRESS | UNIT

NUMBER     ::= [0-9]+
STRING     ::= '"' [^"]* '"'
BOOL       ::= "true" | "false"
ADDRESS    ::= "0x" [0-9a-fA-F]{40}
UNIT       ::= NUMBER ( "ether" | "wei" | "gwei"
                       | "days" | "hours" | "minutes" | "seconds" )

IDENTIFIER ::= [a-zA-Z_][a-zA-Z0-9_]*

NEWLINE    ::= "\n"
INDENT     ::= (indentation level increases)
DEDENT     ::= (indentation level decreases)`,
};

const EBNF_DATA = {
  'ebnf-prog': `program         = { import-stmt } , { top-level-decl } ;

import-stmt     = "import" , IDENTIFIER , [ "from" , STRING ] ;

top-level-decl  = contract-decl | interface-decl
                | struct-decl   | enum-decl ;`,

  'ebnf-contract': `contract-decl   = "contract" , IDENTIFIER , NEWLINE ,
                  INDENT , contract-body , DEDENT ;

contract-body   = { state-decl | event-decl | fn-decl } ;

state-decl      = IDENTIFIER , "=" , expression , NEWLINE
                | IDENTIFIER , "[" , IDENTIFIER , "]"
                  , { "[" , IDENTIFIER , "]" } , NEWLINE ;

event-decl      = "event" , IDENTIFIER ,
                  "(" , [ IDENTIFIER , { "," , IDENTIFIER } ] , ")" , NEWLINE ;

interface-decl  = "interface" , IDENTIFIER , ":" , NEWLINE ,
                  INDENT , { fn-signature } , DEDENT ;

struct-decl     = "struct" , IDENTIFIER , ":" , NEWLINE ,
                  INDENT , IDENTIFIER , { NEWLINE , IDENTIFIER } , NEWLINE , DEDENT ;

enum-decl       = "enum" , IDENTIFIER , ":" , NEWLINE ,
                  INDENT , IDENTIFIER , { NEWLINE , IDENTIFIER } , NEWLINE , DEDENT ;

param-list      = IDENTIFIER , { "," , IDENTIFIER } ;`,

  'ebnf-fn': `fn-decl         = "function" , IDENTIFIER ,
                  "(" , [ param-list ] , ")" , ":" , NEWLINE ,
                  INDENT , fn-body , DEDENT ;

fn-body         = { guard-stmt | statement } ;

guard-stmt      = ( "only" , expression
                  | "lock"
                  | "payable" ) , NEWLINE ;

fn-signature    = "function" , IDENTIFIER , "(" , [ param-list ] , ")" , NEWLINE ;`,

  'ebnf-stmts': `statement       = assign-stmt   | aug-assign-stmt | if-stmt
                | match-stmt    | for-stmt         | while-stmt
                | return-stmt   | emit-stmt        | require-stmt
                | revert-stmt   | send-stmt        | expr-stmt ;

assign-stmt     = lvalue , "=" , expression , NEWLINE ;

aug-assign-stmt = lvalue , ( "+=" | "-=" | "*=" | "/=" ) , expression , NEWLINE ;

lvalue          = IDENTIFIER
                | IDENTIFIER , { "[" , expression , "]" }
                | IDENTIFIER , "." , IDENTIFIER ;

if-stmt         = "if" , expression , ":" , NEWLINE ,
                  INDENT , { statement } , DEDENT ,
                  { "elif" , expression , ":" , NEWLINE , INDENT , { statement } , DEDENT } ,
                  [ "else" , ":" , NEWLINE , INDENT , { statement } , DEDENT ] ;

match-stmt      = "match" , expression , ":" , NEWLINE ,
                  INDENT , { match-arm } , DEDENT ;

match-arm       = IDENTIFIER , ":" , NEWLINE , INDENT , { statement } , DEDENT ;

for-stmt        = "for" , IDENTIFIER , "in" , expression , ":" , NEWLINE ,
                  INDENT , { statement } , DEDENT ;

while-stmt      = "while" , expression , ":" , NEWLINE ,
                  INDENT , { statement } , DEDENT ;

return-stmt     = "return" , [ expression ] , NEWLINE ;
emit-stmt       = "emit" , IDENTIFIER , "(" ,
                  [ IDENTIFIER , ":" , expression ,
                    { "," , IDENTIFIER , ":" , expression } ] , ")" , NEWLINE ;
require-stmt    = "require" , expression , [ "," , STRING ] , NEWLINE ;
revert-stmt     = "revert" , STRING , NEWLINE ;
send-stmt       = "send" , "(" , expression , "," , expression , ")" , NEWLINE ;
expr-stmt       = expression , NEWLINE ;`,

  'ebnf-exprs': `expression      = or-expr ;
or-expr         = and-expr , { "or" , and-expr } ;
and-expr        = not-expr , { "and" , not-expr } ;
not-expr        = [ "not" ] , cmp-expr ;
cmp-expr        = add-expr , { cmp-op , add-expr } ;
cmp-op          = "==" | "!=" | "<" | ">" | "<=" | ">=" ;
add-expr        = mul-expr , { ( "+" | "-" ) , mul-expr } ;
mul-expr        = unary-expr , { ( "*" | "/" | "%" ) , unary-expr } ;
unary-expr      = [ "-" ] , postfix-expr ;
postfix-expr    = primary , { "[" , expression , "]"
                             | "." , IDENTIFIER
                             | "(" , [ arg-list ] , ")" } ;
primary         = LITERAL | IDENTIFIER | "(" , expression , ")" ;
arg-list        = expression , { "," , expression } ;`,
};

/* ──────────────────────────────────────────────
   11. BNF HIGHLIGHTER
   ────────────────────────────────────────────── */
function highlightBNF(text) {
  return text
    .split('\n').map(line => {
      // Escape HTML first
      let l = esc(line);
      // "string terminals" → green
      l = l.replace(/&quot;([^&]*)&quot;/g, '<span class="bnf-t">&quot;$1&quot;</span>');
      // <non-terminal>  → cyan
      l = l.replace(/&lt;([^&]+)&gt;/g, '<span class="bnf-nt">&lt;$1&gt;</span>');
      // ::= and | → purple
      l = l.replace(/(::=|\|)/g, '<span class="bnf-op">$1</span>');
      // UPPERCASE tokens (IDENTIFIER, NEWLINE, etc.) → amber
      l = l.replace(/\b([A-Z_]{2,})\b/g, '<span class="bnf-meta">$1</span>');
      // ε → purple
      l = l.replace(/ε/g, '<span class="bnf-op">ε</span>');
      return l;
    }).join('\n');
}

function highlightEBNF(text) {
  return text
    .split('\n').map(line => {
      let l = esc(line);
      // "terminals" → green
      l = l.replace(/&quot;([^&]*)&quot;/g, '<span class="ebnf-t">&quot;$1&quot;</span>');
      // rule-names (first token before = or first word in continuation) → cyan
      // operators ;  ,  |  {  }  [  ]  ( ) = → purple
      l = l.replace(/([;,|{}[\]()]|(?<![a-z])=(?!=))/g, '<span class="ebnf-op">$1</span>');
      // UPPERCASE → amber
      l = l.replace(/\b([A-Z_]{2,})\b/g, '<span class="bnf-meta">$1</span>');
      return l;
    }).join('\n');
}

/* ──────────────────────────────────────────────
   12. GRAMMAR TABS INIT
   ────────────────────────────────────────────── */
function initGrammarTabs() {
  // BNF
  setupGrammarGroup('bnf-nav', BNF_DATA, highlightBNF);
  // EBNF
  setupGrammarGroup('ebnf-nav', EBNF_DATA, highlightEBNF);
}

function setupGrammarGroup(navId, data, highlighter) {
  const nav   = document.getElementById(navId);
  if (!nav) return;
  const btns  = nav.querySelectorAll('.gnav-btn');

  // Populate code elements
  Object.entries(data).forEach(([id, raw]) => {
    const el = document.getElementById(id + '-code');
    if (el) el.innerHTML = highlighter(raw);
  });

  // Tab switching
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      // hide all panes in same section
      const wrap = nav.nextElementSibling;
      wrap.querySelectorAll('.grammar-pane').forEach(p => p.classList.remove('active'));
      const targetPane = document.getElementById(target);
      if (targetPane) targetPane.classList.add('active');
      // update buttons
      btns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active'); btn.setAttribute('aria-selected', 'true');
    });
  });
}

/* ──────────────────────────────────────────────
   13. PARADIGM SCROLL ANIMATIONS
   ────────────────────────────────────────────── */
function initParadigmAnimations() {
  const cards = document.querySelectorAll('.paradigm-card');
  const vs    = document.querySelector('.paradigm-vs');

  // Stagger delays
  cards.forEach((c, i) => { c.style.animationDelay = (i * 0.08) + 's'; });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  cards.forEach(c => observer.observe(c));
  if (vs) observer.observe(vs);
}

/* ──────────────────────────────────────────────
   14. LANGUAGE REFERENCE SECTION
   ────────────────────────────────────────────── */
const REF_CODES = {
  'ref-guards-code': `function deposit():
    payable                -- ✓ accepts ETH
    only buyer             -- ✓ only buyer can call
    require state == State.Awaiting
    amount = value

function withdraw(amount):
    lock                   -- ✓ reentrancy guard
    only admin
    require balance >= amount
    balance -= amount
    send(admin, amount)`,

  'ref-units-code': `-- ETH denominations
fee      = 50 gwei
deposit  = 1 ether
dust     = 100 wei

-- Time durations
cooldown = 24 hours
deadline = now + 30 days
lockup   = now + 52 * 7 days`,

  'ref-comments-code': `-- single-line comment: ignored by compiler

--[
  Multi-line comment.
  Useful for big explanations.
  Can be nested if needed.
]--

--- Doc comment: exported to HTML docs
--- @param to   Recipient address
--- @param amt  Amount in wei
function transfer(to, amt):
    require balance[sender] >= amt
    balance[sender] -= amt
    balance[to]     += amt`,

  'ref-safe-overflow-code': `-- underflow protection (auto)
balance[sender] -= amount
-- reverts if balance[sender] < amount
-- no require needed for the math itself`,

  'ref-safe-only-code': `only owner          -- sender == owner
only admin          -- sender == admin
only self           -- sender == address(this)
only treasury       -- sender == treasury address`,

  'ref-safe-lock-code': `function withdraw(amount):
    lock                   -- mutex ON
    require balance[sender] >= amount
    balance[sender] -= amount
    send(sender, amount)   -- safe: state updated first
                           -- mutex OFF (auto)`,

  'ref-safe-payable-code': `function transfer(to, amount):
    -- no payable → ETH rejected automatically
    balance[sender] -= amount
    balance[to] += amount

function deposit():
    payable               -- ETH accepted
    balance[sender] += value`,

  'ref-safe-map-code': `balance[address]
-- unset key returns 0  (no null, no throw)

approved[address][address]
-- unset nested key returns false`,

  'ref-safe-err-code': `Error [E012]: access control violation
  --> Token.miso:8:5
   |
 8 |     balance[user] += amount
   |     ^^^^^^^^^^^^^^^^^^^^^^^
   |     State modified but no \`only\` guard present.
   |     Anyone can call this and mint tokens.
   |
   = help: Add \`only owner\` as first line.`,

  'ref-cli-code': `$ misolc compile  Token.miso
  → Token.abi.json   (36 lines)
  → Token.bin        (EVM bytecode)

$ misolc check    Token.miso
  ✓ No type errors
  ✓ All functions guarded

$ misolc fmt      Token.miso
  ✓ Formatted in-place

$ misolc docs     Token.miso
  → Token.html       (generated docs)

$ misolc test     ./tests/
  ✓ 12 passed  0 failed`,
};

function initReference() {
  // Populate code snippets
  Object.entries(REF_CODES).forEach(([id, raw]) => {
    const el = document.getElementById(id);
    if (!el) return;
    // Safety section uses Misoltav highlighting; CLI uses plain
    if (id === 'ref-cli-code' || id === 'ref-safe-err-code') {
      el.innerHTML = esc(raw);
    } else {
      el.innerHTML = highlightMiso(raw);
    }
  });

  // Tab switching
  const tabBar  = document.getElementById('ref-tabs');
  if (!tabBar) return;
  const tabs    = tabBar.querySelectorAll('.ref-tab');
  const refBody = tabBar.nextElementSibling;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.ref;
      // hide all panes
      refBody.querySelectorAll('.ref-pane').forEach(p => p.classList.remove('active'));
      const pane = document.getElementById(target);
      if (pane) pane.classList.add('active');
      // update tabs
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active'); tab.setAttribute('aria-selected', 'true');
    });
  });
}

/* ──────────────────────────────────────────────
   15. PLAYGROUND
   ────────────────────────────────────────────── */
const PG_SAMPLES = {
  hello: `contract HelloWorld
    greeting = "Hello, Misoltav!"

    function getGreeting():
        return greeting

    function setGreeting(newGreeting):
        only sender
        greeting = newGreeting`,

  storage: `contract Storage
    val = 0

    function store(x):
        val = x

    function retrieve():
        return val`,

  blank: `contract MyContract
    owner = sender

    function example():
        only owner
        -- write your logic here`,
};

/* ── Compiler simulation ─────────────────────── */
function pgCompile(code) {
  const lines  = code.split('\n');
  const errors = [];
  const warns  = [];
  const info   = [];

  let contractName  = null;
  let functions     = [];
  let events        = [];
  let stateVars     = [];
  let hasContract   = false;

  lines.forEach((raw, idx) => {
    const ln = idx + 1;
    const line = raw.trimStart();

    // Detect contract
    if (/^contract\s+\w+/.test(line)) {
      const m = line.match(/^contract\s+(\w+)/);
      contractName = m ? m[1] : 'Unknown';
      hasContract  = true;
    }

    // Collect function declarations
    if (/^function\s+\w+/.test(line)) {
      const m = line.match(/^function\s+(\w+)\s*\(([^)]*)\)/);
      if (m) functions.push({ name: m[1], params: m[2].split(',').map(s => s.trim()).filter(Boolean), ln });
    }

    // Collect events
    if (/^event\s+\w+/.test(line)) {
      const m = line.match(/^event\s+(\w+)/);
      if (m) events.push(m[1]);
    }

    // Collect state vars — simple assignments and mappings
    if (hasContract && /^    \w+(\[address\])*\s*=/.test(raw)) {
      const m = raw.match(/^\s+(\w+)/);
      if (m && !['only','lock','payable','require','return','emit','revert','send','if','elif','else','match','for','while'].includes(m[1])) {
        stateVars.push(m[1]);
      }
    }
    if (hasContract && /^\s+\w+\[address\]/.test(raw) && !/=/.test(raw)) {
      const m = raw.match(/^\s+(\w+)/);
      if (m) stateVars.push(m[1] + '[]');
    }

    // Check: function with state mutation but no 'only' / 'lock' guard
    // (simple heuristic: if line has += or -= and NOT inside a function with 'require')
    // just flag if function does -= without require above it
    if (/^\s+\w+\[.+\]\s*-=/.test(raw)) {
      const fnBlock = lines.slice(Math.max(0, idx - 10), idx);
      const hasRequire = fnBlock.some(l => /^\s+(require|only|lock)/.test(l));
      if (!hasRequire) {
        warns.push({ ln, msg: `Subtraction without guard — ensure "${raw.trim()}" has a require above it.` });
      }
    }

    // Check: send() without lock
    if (/^\s+send\(/.test(raw)) {
      const fnBlock = lines.slice(Math.max(0, idx - 12), idx);
      const hasLock = fnBlock.some(l => /^\s+lock\s*$/.test(l));
      if (!hasLock) {
        warns.push({ ln, msg: `send() without lock — consider adding 'lock' at the top of this function to prevent reentrancy.` });
      }
    }

    // Unknown keyword at contract level
    if (/^contract\s/.test(line) === false && /^(struct|enum|interface|import)\s/.test(line) === false
        && /^\w/.test(line) && hasContract === false && line.trim() !== '') {
      errors.push({ ln, msg: `Unexpected top-level statement before 'contract'. All code must be inside a contract.` });
    }
  });

  if (!hasContract) {
    errors.push({ ln: 1, msg: `No contract declaration found. Every Misoltav file must start with: contract <Name>` });
  }

  return { contractName, functions, events, stateVars, errors, warns, info };
}

const MISOLC_VERSION = 'v2.8.8';

/* ── Deterministic fake bytecode from contract name (Remix-length hex) ─ */
function fakeBytecode(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  const seed = Math.abs(h);
  let hex = '608060405234801561001057600080fd5b5038';
  const chars = '0123456789abcdef';
  for (let i = 0; i < 320; i++) hex += chars[(seed * (i + 7) * 13 + i * i) & 15];
  hex += '5056fea2646970667358221220';
  for (let i = 0; i < 64; i++) hex += chars[(seed + i * 3) & 15];
  hex += '64736f6c634300081c0033';
  return hex;
}

/* ── Deterministic fake gas estimate ─ */
function fakeGas(fnName, params) {
  let h = 0;
  for (const c of fnName) h = (h * 31 + c.charCodeAt(0)) | 0;
  const base = 21000 + Math.abs(h) % 40000;
  const paramGas = params.length * 2100;
  return (base + paramGas).toLocaleString();
}

/* Fake contract address (Remix-style truncated) */
function fakeDeployAddress(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  const hex = '0123456789abcdef';
  let addr = '0x';
  for (let i = 0; i < 40; i++) addr += hex[Math.abs(h + i * 17) % 16];
  return { full: addr, short: `${addr.slice(0, 6)}...${addr.slice(-4)}` };
}

function isRemixCallOnly(fnName) {
  const n = (fnName || '').toLowerCase();
  if (/^(get|retrieve|view|balance|allowance|total|name|symbol|decimals)/.test(n)) return true;
  if (n === 'getgreeting') return true;
  return false;
}

function pgRender(out, result, elapsed, onDone) {
  const { contractName, functions, events, stateVars, errors, warns } = result;
  const ts = new Date().toLocaleTimeString();

  let html = '';

  /* ── Top log line (Remix-style) ── */
  html += `
  <div class="remix-logline remix-logline-hdr">
    <span class="remix-badge remix-badge-info">i</span>
    <span class="remix-logline-ts">[${ts}]</span>
    <span class="remix-logline-txt">misolc ${MISOLC_VERSION} compilation started</span>
    <span class="remix-logline-elapsed">${elapsed} ms</span>
  </div>`;

  /* ── ERRORS ── */
  if (errors.length) {
    errors.forEach(e => {
      html += `
      <div class="remix-logline remix-logline-err">
        <span class="remix-badge remix-badge-err">✕</span>
        <span class="remix-logline-ts">[${ts}]</span>
        <span class="remix-logline-txt"><span class="remix-err-loc">line ${e.ln}</span> ${esc(e.msg)}</span>
      </div>`;
    });
    html += `
    <div class="remix-compile-box remix-compile-box-err">
      <div class="remix-compile-box-title">
        <span class="remix-icon-err">✕</span> Compilation failed
      </div>
      <div class="remix-compile-detail">${errors.length} error${errors.length > 1 ? 's' : ''} found. Fix the issues above and try again.</div>
    </div>`;
    out.innerHTML = html;
    if (typeof onDone === 'function') onDone({ ok: false, contractName, errors });
    return;
  }

  /* ── Remix green “compiled ✓” banner ── */
  html += `
  <div class="remix-compiled-banner" role="status">
    <span class="remix-compiled-icon">✓</span>
    <span class="remix-compiled-text">compiled</span>
  </div>`;

  /* ── PASS LOG ── */
  const passes = [
    { label: 'Lexer', ok: true },
    { label: 'Parser', ok: true },
    { label: 'Name resolver', ok: true },
    { label: 'Type inference', ok: true },
    { label: 'Safety analyser', ok: warns.length === 0, warns: warns.length },
    { label: 'IR lowering', ok: true },
    { label: 'Optimiser (O2)', ok: true },
    { label: 'EVM code generation', ok: true },
  ];

  html += `<div class="remix-pass-list">`;
  passes.forEach(p => {
    const cls = p.ok ? 'remix-pass-ok' : 'remix-pass-warn';
    const icon = p.ok ? '✓' : '⚠';
    const note = p.warns ? ` <span class="remix-warn-pill">${p.warns} warning${p.warns > 1 ? 's' : ''}</span>` : '';
    html += `<div class="remix-pass ${cls}"><span class="remix-pass-icon">${icon}</span>${esc(p.label)}${note}</div>`;
  });
  html += `</div>`;

  /* ── WARNINGS ── */
  if (warns.length) {
    warns.forEach(w => {
      html += `
      <div class="remix-logline remix-logline-warn">
        <span class="remix-badge remix-badge-warn">⚠</span>
        <span class="remix-logline-ts">[${ts}]</span>
        <span class="remix-logline-txt"><span class="remix-warn-loc">line ${w.ln}</span> ${esc(w.msg)}</span>
      </div>`;
    });
  }

  /* ── CONTRACT INFO BOX ── */
  const bytecode  = fakeBytecode(contractName);
  const byteLen   = Math.floor(bytecode.length / 2);

  html += `
  <div class="remix-compile-box remix-compile-box-ok">
    <div class="remix-compile-box-title">
      <span class="remix-icon-ok">✓</span>
      <span class="remix-compile-name">${esc(contractName)}</span>
      <span class="remix-compile-badges">
        <span class="remix-compile-badge-fn">${functions.length} fn</span>
        <span class="remix-compile-badge-ev">${events.length} events</span>
      </span>
    </div>

    <div class="remix-section-label">BYTECODE</div>
    <div class="remix-bytecode-toolbar">
      <span class="remix-byte-size">${byteLen} bytes</span>
      <button type="button" class="remix-copy-bytecode" id="remix-copy-bytecode" title="Copy bytecode">Copy</button>
    </div>
    <pre class="remix-bytecode-pre" id="remix-bytecode-pre"><code>${bytecode}</code></pre>

    <div class="remix-section-label">GAS ESTIMATES</div>
    <table class="remix-gas-table">
      <thead><tr><th>Function</th><th>Signature</th><th>Min gas</th></tr></thead>
      <tbody>
        ${functions.map(f => `
        <tr>
          <td class="remix-gas-fn">${esc(f.name)}</td>
          <td class="remix-gas-sig">${esc(f.name)}(${f.params.map(() => 'uint256').join(', ')})</td>
          <td class="remix-gas-val">${fakeGas(f.name, f.params)}</td>
        </tr>`).join('')}
        ${functions.length === 0 ? '<tr><td colspan="3" style="color:var(--remix-dim)">No callable functions</td></tr>' : ''}
      </tbody>
    </table>

    <!-- ABI accordion -->
    <div class="remix-section-label" style="margin-top:14px">ABI
      <button class="remix-abi-toggle" id="remix-abi-toggle" aria-expanded="false">▸ expand</button>
    </div>
    <div class="remix-abi-pre" id="remix-abi-pre" hidden>
      <code>${esc(JSON.stringify(
        [
          ...functions.map(f => ({
            type: 'function',
            name: f.name,
            inputs: f.params.map(p => ({ name: p, type: 'uint256' })),
            outputs: [],
            stateMutability: f.name.includes('deposit') || f.name.includes('contribute') ? 'payable' : 'nonpayable',
          })),
          ...events.map(e => ({ type: 'event', name: e, inputs: [], anonymous: false })),
        ],
        null, 2
      ))}</code>
    </div>

  </div>`;

  /* ── State vars ── */
  if (stateVars.length) {
    html += `
    <div class="remix-logline remix-logline-info">
      <span class="remix-badge remix-badge-info">S</span>
      <span class="remix-logline-ts">[${ts}]</span>
      <span class="remix-logline-txt">State: ${stateVars.map(v => `<code class="remix-ic">${esc(v)}</code>`).join(' ')}</span>
    </div>`;
  }

  /* ── Events ── */
  events.forEach(ev => {
    html += `
    <div class="remix-logline remix-logline-ev">
      <span class="remix-badge remix-badge-ev">E</span>
      <span class="remix-logline-ts">[${ts}]</span>
      <span class="remix-logline-txt">event declared: <code class="remix-ic">${esc(ev)}</code></span>
    </div>`;
  });

  /* ── Done ── */
  html += `
  <div class="remix-logline remix-logline-ok">
    <span class="remix-badge remix-badge-ok">✓</span>
    <span class="remix-logline-ts">[${ts}]</span>
    <span class="remix-logline-txt">Compilation finished in ${elapsed}&thinsp;ms</span>
  </div>`;

  out.innerHTML = html;

  const abiBtn = document.getElementById('remix-abi-toggle');
  const abiPre = document.getElementById('remix-abi-pre');
  abiBtn?.addEventListener('click', () => {
    const open = abiPre.hidden;
    abiPre.hidden = !open;
    abiBtn.textContent = open ? '▾ collapse' : '▸ expand';
    abiBtn.setAttribute('aria-expanded', String(open));
  });

  document.getElementById('remix-copy-bytecode')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(bytecode).then(() => {
      const b = document.getElementById('remix-copy-bytecode');
      if (b) { const t = b.textContent; b.textContent = 'Copied'; setTimeout(() => { b.textContent = t; }, 1500); }
    });
  });

  if (typeof onDone === 'function') {
    onDone({ ok: true, contractName, functions, events, byteLen, elapsed, bytecode });
  }
}


function initPlayground() {
  const overlay     = document.getElementById('playground-overlay');
  const openBtn     = document.getElementById('nav-cta-btn');
  const closeBtn    = document.getElementById('pg-close-btn');
  const runBtn      = document.getElementById('pg-run-btn');
  const editor      = document.getElementById('pg-editor');
  const highlight   = document.querySelector('#pg-highlight code');
  const lineNums    = document.getElementById('pg-line-nums');
  const charCount   = document.getElementById('pg-char-count');
  const lineCount   = document.getElementById('pg-line-count');
  const outputEl    = document.getElementById('pg-output');
  const statusSub   = document.getElementById('pg-output-status');
  const sampleSel   = document.getElementById('pg-sample-select');
  const tabCompile   = document.getElementById('pg-tab-compile');
  const tabConsole   = document.getElementById('pg-tab-console');
  const tabDeployed  = document.getElementById('pg-tab-deployed');
  const panelCompile = document.getElementById('pg-panel-compile');
  const panelConsole = document.getElementById('pg-panel-console');
  const panelDeployed = document.getElementById('pg-panel-deployed');
  const deployedRoot = document.getElementById('pg-deployed-root');
  const deployBtn    = document.getElementById('pg-deploy-btn');
  const consoleBody = document.getElementById('pg-console-body');
  const consoleBadge = document.getElementById('pg-console-badge');
  const consoleClear = document.getElementById('pg-console-clear');
  let consoleLineCount = 0;
  let lastCompileResult = null;
  const deployRuntime = { storage: {}, greeting: 'Hello, Misoltav!' };

  function pgSwitchTab(which) {
    if (tabCompile) {
      tabCompile.classList.toggle('active', which === 'compile');
      tabCompile.setAttribute('aria-selected', which === 'compile');
    }
    if (tabConsole) {
      tabConsole.classList.toggle('active', which === 'console');
      tabConsole.setAttribute('aria-selected', which === 'console');
    }
    if (tabDeployed) {
      tabDeployed.classList.toggle('active', which === 'deployed');
      tabDeployed.setAttribute('aria-selected', which === 'deployed');
    }
    if (panelCompile) panelCompile.hidden = which !== 'compile';
    if (panelConsole) panelConsole.hidden = which !== 'console';
    if (panelDeployed) panelDeployed.hidden = which !== 'deployed';
  }

  function clearDeployedUI() {
    if (!deployedRoot) return;
    deployedRoot.innerHTML = `<div class="pg-deployed-empty" id="pg-deployed-empty">
      <p><strong>Deployed Contracts</strong></p>
      <p class="pg-deployed-empty-hint">Compile successfully, then press <strong>Deploy</strong> in the header to interact like Remix.</p>
    </div>`;
  }

  function renderDeployedPanel(contractName, functions) {
    if (!deployedRoot) return;
    const { full, short } = fakeDeployAddress(contractName);
    const upper = (contractName || 'Contract').toUpperCase();
    const fnRows = (functions || []).map((f) => {
      const callOnly = f.params.length === 0 || isRemixCallOnly(f.name);
      const btnClass = callOnly ? 'remix-fn-btn-call' : 'remix-fn-btn-tx';
      const inputs = f.params.map((p, i) =>
        `<input type="text" class="remix-fn-input" data-param="${i}" placeholder="${esc(p || 'uint256')}" aria-label="${esc(f.name)} arg ${i + 1}" />`
      ).join('');
      return `
      <div class="remix-fn-block" data-fn="${esc(f.name)}">
        <div class="remix-fn-row">
          <button type="button" class="${btnClass}" data-action="exec">${esc(f.name)}</button>
          ${inputs}
          <span class="remix-fn-caret" aria-hidden="true">▾</span>
        </div>
        <div class="remix-fn-out" data-out="${esc(f.name)}"></div>
      </div>`;
    }).join('');

    deployedRoot.innerHTML = `
    <div class="remix-deployed-header">
      <div class="remix-deployed-title">
        Deployed Contracts <span class="remix-deployed-count">1</span>
      </div>
      <button type="button" class="remix-deployed-trash" id="remix-deployed-trash" title="Clear deployments">🗑</button>
    </div>
    <div class="remix-instance" id="remix-instance-box">
      <div class="remix-instance-head">
        <span class="remix-instance-chevron">▼</span>
        <span class="remix-instance-title">${upper} AT ${short.toUpperCase()}:</span>
        <div class="remix-instance-actions">
          <button type="button" id="remix-copy-addr" title="Copy address">⎘</button>
          <button type="button" title="Pin">📌</button>
          <button type="button" id="remix-close-instance" title="Remove">✕</button>
        </div>
      </div>
      <div class="remix-instance-body">
        <div class="remix-balance">Balance: 0 ETH</div>
        ${fnRows || '<p style="color:rgba(255,255,255,0.4);font-size:0.78rem">No public functions detected.</p>'}
      </div>
    </div>`;

    deployedRoot.dataset.deployAddress = full;

    document.getElementById('remix-copy-addr')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(full);
    });
    const remove = () => {
      clearDeployedUI();
      if (deployBtn && lastCompileResult && !lastCompileResult.errors?.length) deployBtn.disabled = false;
      pgSwitchTab('deployed');
    };
    document.getElementById('remix-deployed-trash')?.addEventListener('click', remove);
    document.getElementById('remix-close-instance')?.addEventListener('click', remove);

    deployedRoot.querySelectorAll('.remix-fn-block').forEach((block) => {
      const fnName = block.getAttribute('data-fn');
      const outEl = block.querySelector('[data-out]');
      block.querySelector('[data-action="exec"]')?.addEventListener('click', () => {
        const inputs = [...block.querySelectorAll('.remix-fn-input')].map((el) => el.value.trim());
        const n = (fnName || '').toLowerCase();
        if ((n === 'store' || n === 'setgreeting') && inputs[0] !== '') {
          if (n === 'store') deployRuntime.storage._slot0 = inputs[0];
          else deployRuntime.greeting = inputs[0];
          if (outEl) outEl.textContent = '';
          pgConsoleAppend('pg-console-dim', `<span class="pg-console-ts">[tx]</span> ${esc(fnName)}(${esc(inputs[0])}) — transact ok`);
          return;
        }
        if (n === 'retrieve' || n === 'get') {
          const v = deployRuntime.storage._slot0 ?? '0';
          if (outEl) outEl.textContent = `0: uint256: ${v}`;
          pgConsoleAppend('pg-console-dim', `<span class="pg-console-ts">[call]</span> ${esc(fnName)}() → uint256 ${esc(v)}`);
          return;
        }
        if (n === 'getgreeting') {
          const v = deployRuntime.greeting;
          if (outEl) outEl.textContent = `0: string: "${v}"`;
          return;
        }
        if (inputs.length === 0 || isRemixCallOnly(fnName)) {
          const fake = String(Math.floor(Math.random() * 1e6));
          if (outEl) outEl.textContent = `0: uint256: ${fake}`;
          return;
        }
        if (outEl) outEl.textContent = '';
        pgConsoleAppend('pg-console-ok', `<span class="pg-console-ts">[tx]</span> ${esc(fnName)}(${esc(inputs.join(', '))}) — transact ok · gas ${fakeGas(fnName, inputs)}`);
      });
    });
  }

  function pgConsoleAppend(htmlClass, text) {
    if (!consoleBody) return;
    const hint = consoleBody.querySelector('.pg-console-hint');
    if (hint) hint.remove();
    const row = document.createElement('div');
    row.className = `pg-console-line ${htmlClass}`;
    row.innerHTML = text;
    consoleBody.appendChild(row);
    consoleBody.scrollTop = consoleBody.scrollHeight;
    consoleLineCount++;
    if (consoleBadge) {
      consoleBadge.hidden = false;
      consoleBadge.textContent = String(consoleLineCount);
    }
  }

  if (tabCompile) tabCompile.addEventListener('click', () => pgSwitchTab('compile'));
  if (tabConsole) tabConsole.addEventListener('click', () => pgSwitchTab('console'));
  if (tabDeployed) tabDeployed.addEventListener('click', () => pgSwitchTab('deployed'));

  if (deployBtn) {
    deployBtn.addEventListener('click', () => {
      if (!lastCompileResult || lastCompileResult.errors?.length || !lastCompileResult.contractName) return;
      renderDeployedPanel(lastCompileResult.contractName, lastCompileResult.functions);
      pgSwitchTab('deployed');
      const ts = new Date().toLocaleTimeString();
      pgConsoleAppend('pg-console-ok', `<span class="pg-console-ts">[${ts}]</span> <strong>deployment</strong> — ${esc(lastCompileResult.contractName)} @ ${fakeDeployAddress(lastCompileResult.contractName).short}`);
    });
  }
  if (consoleClear) {
    consoleClear.addEventListener('click', () => {
      if (!consoleBody) return;
      consoleBody.innerHTML = '<div class="pg-console-hint">Console cleared.</div>';
      consoleLineCount = 0;
      if (consoleBadge) consoleBadge.hidden = true;
    });
  }

  if (!overlay || !openBtn) return;

  // Open
  function openPlayground() {
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    if (!editor.value) loadSample('token');
    setTimeout(() => editor.focus(), 60);
  }

  // Close
  function closePlayground() {
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  openBtn.addEventListener('click', openPlayground);
  closeBtn.addEventListener('click', closePlayground);
  overlay.addEventListener('click', e => { if (e.target === overlay) closePlayground(); });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.hidden) closePlayground();
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !overlay.hidden) { e.preventDefault(); runCompiler(); }
  });

  // Load sample
  function loadSample(key) {
    const code = PG_SAMPLES[key] || '';
    editor.value = code;
    updateHighlight();
    updateStatusBar();
    // reset output
    outputEl.innerHTML = '<div class="pg-output-welcome"><div class="pg-welcome-icon">⬡</div><p>Press <strong>Run</strong> to compile this contract.</p></div>';
    statusSub.textContent = '— press Run to compile';
    lastCompileResult = null;
    if (deployBtn) { deployBtn.disabled = true; deployBtn.title = 'Compile first'; }
    clearDeployedUI();
  }

  sampleSel.addEventListener('change', () => loadSample(sampleSel.value));

  // Live highlighting
  function updateHighlight() {
    if (!highlight) return;
    highlight.innerHTML = highlightMiso(editor.value || '');
    // sync scroll
    const pre = highlight.parentElement;
    pre.scrollTop  = editor.scrollTop;
    pre.scrollLeft = editor.scrollLeft;
  }

  function updateLineNumbers() {
    if (!lineNums) return;
    const count = (editor.value.match(/\n/g) || []).length + 1;
    lineNums.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
    lineNums.scrollTop = editor.scrollTop;
  }

  function updateStatusBar() {
    const txt  = editor.value;
    const lns  = txt.split('\n').length;
    charCount.textContent = txt.length + ' chars';
    lineCount.textContent = lns + ' lines';
  }

  editor.addEventListener('input', () => {
    updateHighlight();
    updateLineNumbers();
    updateStatusBar();
  });

  editor.addEventListener('scroll', () => {
    const pre = highlight?.parentElement;
    if (pre) { pre.scrollTop = editor.scrollTop; pre.scrollLeft = editor.scrollLeft; }
    if (lineNums) lineNums.scrollTop = editor.scrollTop;
  });

  // Tab key → insert 4 spaces
  editor.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = editor.selectionStart;
      const v = editor.value;
      editor.value = v.slice(0, s) + '    ' + v.slice(editor.selectionEnd);
      editor.selectionStart = editor.selectionEnd = s + 4;
      updateHighlight();
      updateLineNumbers();
    }
  });

  // Run compiler
  function runCompiler() {
    const code = editor.value.trim();
    if (!code) {
      outputEl.innerHTML = '<div class="pg-result pg-result-warn">⚠ Nothing to compile — write a contract first.</div>';
      return;
    }
    runBtn.classList.add('running');
    statusSub.textContent = '— compiling…';

    // Simulate async compile delay
    const t0 = performance.now();
    setTimeout(() => {
      const result  = pgCompile(code);
      const elapsed = Math.round(performance.now() - t0);
      pgSwitchTab('compile');
      lastCompileResult = result;
      if (deployBtn) {
        deployBtn.disabled = result.errors.length > 0;
        deployBtn.title = result.errors.length ? 'Fix compile errors first' : 'Deploy to local VM (Remix-style)';
      }
      pgRender(outputEl, result, elapsed, (info) => {
        const ts = new Date().toLocaleTimeString();
        if (info.ok) {
          pgConsoleAppend('pg-console-ok', `<span class="pg-console-ts">[${ts}]</span> <strong>compile succeeded</strong> — ${esc(info.contractName)} (${info.byteLen} bytes, ${elapsed} ms)`);
          info.functions.forEach((f) => {
            pgConsoleAppend('pg-console-dim', `<span class="pg-console-ts">[${ts}]</span>   ${esc(f.name)}() min gas ${fakeGas(f.name, f.params)}`);
          });
          pgConsoleAppend('pg-console-dim', `<span class="pg-console-ts">[${ts}]</span> Press <strong>Deploy</strong> then open <strong>Deployed</strong> to call functions.`);
        } else {
          pgConsoleAppend('pg-console-err', `<span class="pg-console-ts">[${ts}]</span> <strong>compile failed</strong> — ${info.errors.length} error(s)`);
        }
      });
      runBtn.classList.remove('running');
      statusSub.textContent = result.errors.length
        ? `— ${result.errors.length} error${result.errors.length > 1 ? 's' : ''}`
        : `— compiled \u2713 · Deploy ready`;
    }, 320 + Math.random() * 180);
  }

  runBtn.addEventListener('click', runCompiler);

  // Also wire hero buttons
  document.getElementById('hero-explore-btn')?.addEventListener('click', openPlayground);
}
