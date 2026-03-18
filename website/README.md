# Misoltav Website — Project README

## What is this project? (Easy explanation)

**Misoltav** is a *made-up but fully specified* **beginner-friendly smart contract language** — like Solidity, but meant to read more like plain English and hide security boilerplate (reentrancy, overflow, access control) behind simple keywords.

This **website** is the **landing + documentation** for that language:

| Piece | Role |
|--------|------|
| **One long scroll page** | Introduces the language, shows grammar (BNF/EBNF), reference, examples, compiler pipeline, roadmap |
| **Playground (modal)** | Lets visitors type sample contracts, run a **demo “compiler”**, and simulate deploy/call (UI demo, not a real chain) |

**Tech stack:** static HTML + CSS + vanilla JavaScript, **Three.js** for the hero 3D background. No build step — open `index.html` in a browser (or serve the folder).

**Real-world compiler:** The **`../compiler/`** directory contains **misolc** — a Misoltav compiler and transpiler. Use **transpile** to emit Solidity (full Solidity parity: control flow, structs, enums, inheritance, errors) or **compile** for native EVM bytecode + ABI. See [../compiler/README.md](../compiler/README.md). For production use: `misolc transpile <file.miso> -o out.sol` then build with Foundry/Hardhat.

---

## How to run it (step-by-step)

**Step 1: Install dependencies**  
From the **project root**:
```bash
npm install
```

**Step 2: Build the browser compiler (one-time)**  
```bash
npm run build:compiler
```
This creates `website/compiler-browser.js` so the real compiler runs in the browser (native Misoltav → EVM bytecode + ABI).

**Step 3: Start the website**  
```bash
npm start
```
Server runs at http://localhost:3000 (or the next free port if 3000 is busy).

**Step 4: Open the playground**  
In the browser, click **Try it** in the nav (or **Explore Language** in the hero).

**Step 5: Choose a file**  
Use the dropdown: **Hello World**, **Storage**, or **Write**.
- **Hello World** / **Storage**: load a sample contract.
- **Write**: load a minimal template so you can type and test your own code.

**Step 6: Edit code (optional for Write)**  
Edit the Misoltav (`.miso`) code in the left panel.

**Step 7: Run**  
Click **Run**. The real compiler runs (in browser or via server) and the right panel shows:
- Bytecode (native EVM)
- ABI (expandable)
- Compile log and any errors.

**Step 8: Deploy and interact (optional)**  
Click **Deploy**, then open the **Deployed** tab. Call functions (e.g. `store`, `retrieve`) and see real output.

---

**Alternative: Python server**  
From project root after `npm run build:compiler`:
```bash
cd website && python3 -m http.server 8080
```
Visit http://localhost:8080 — Try it → Run uses the real compiler.

If you skip `build:compiler`, Try it → Run falls back to simulated output when the Node server isn’t running.

---

## “Pages” = sections on one page

The nav links scroll to **anchors** (`#hero`, `#features`, …). Each section has its own README under **`docs/pages/`** for your presentation.

| Section | README | One-line pitch |
|---------|--------|----------------|
| Hero | [docs/pages/01-hero.md](docs/pages/01-hero.md) | First impression + tagline |
| Philosophy | [docs/pages/02-philosophy.md](docs/pages/02-philosophy.md) | Why Misoltav exists (3 principles) |
| Features | [docs/pages/03-features.md](docs/pages/03-features.md) | What makes the language different |
| Paradigm | [docs/pages/04-paradigm.md](docs/pages/04-paradigm.md) | How the language “thinks” |
| BNF | [docs/pages/05-bnf.md](docs/pages/05-bnf.md) | Formal grammar (classic BNF) |
| EBNF | [docs/pages/06-ebnf.md](docs/pages/06-ebnf.md) | Shorter grammar notation |
| Reference | [docs/pages/07-reference.md](docs/pages/07-reference.md) | Keywords, guards, CLI cheat sheet |
| Syntax | [docs/pages/08-syntax.md](docs/pages/08-syntax.md) | Misoltav vs Solidity side by side |
| Examples | [docs/pages/09-examples.md](docs/pages/09-examples.md) | Full sample contracts |
| Architecture | [docs/pages/10-architecture.md](docs/pages/10-architecture.md) | Compiler pipeline (8 stages) |
| Keywords strip | [docs/pages/11-keywords-strip.md](docs/pages/11-keywords-strip.md) | Quick guard/context/builtins recap |
| Use cases | [docs/pages/12-usecases.md](docs/pages/12-usecases.md) | What you could build |
| Roadmap | [docs/pages/13-roadmap.md](docs/pages/13-roadmap.md) | Future work (phases 1–10) |
| Playground | [docs/pages/14-playground.md](docs/pages/14-playground.md) | Try-it modal + demo compile |

---

## Files in this repo

| File | Purpose |
|------|---------|
| `index.html` | All sections + Playground markup |
| `style.css` | Dark theme, layout, animations |
| `app.js` | Three.js hero, tabs, grammar text, playground simulation |

---

## 2-minute presentation script (optional)

1. **Hook:** “Smart contracts are hard to read and easy to get wrong. Misoltav is a language design that prioritizes readability and safe defaults.”
2. **Demo:** Scroll **Hero → Features → Syntax** (show fewer lines vs Solidity).
3. **Depth:** **BNF/EBNF** = we have a real grammar; **Architecture** = we know how a compiler would work.
4. **Interactive:** Click **Try it →** → **Run** → **Deploy** (explain it’s a UI demo).
5. **Honesty:** **Roadmap** — spec + site are ahead; full compiler is planned.

---

## License / attribution

As shown in the footer: Misoltav Language Specification v2.0 · Apache 2.0 (if that matches your assignment).
