# Contributing to LumensBlock

LumensBlock is open source under the MIT licence. Contributions of all sizes are welcome — from typo fixes to new block types. This guide walks you from a fresh clone to running the editor locally, explains how the pieces fit together, and documents the conventions the project follows.

If anything here is unclear or out of date, please [open an issue](https://github.com/OpenCloudz/lumens-block/issues) so we can fix it.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Project Architecture](#project-architecture)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)
- [Code Style](#code-style)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Testnet Setup (Freighter)](#testnet-setup-freighter)
- [Reporting Bugs & Feature Requests](#reporting-bugs--feature-requests)

---

## Prerequisites

Before you begin, install the following tools. The versions below are what the project is built and tested against; the CI pipeline uses the same Node.js version.

| Tool | Minimum version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18 LTS | The CI pipeline runs on Node.js 18. Node.js 20 LTS also works. Verify with `node --version`. |
| [npm](https://docs.npmjs.com/) | 10.x | Ships with Node.js 18+. Verify with `npm --version`. |
| [Rust](https://www.rust-lang.org/tools/install) | stable toolchain | Installed via `rustup`. Verify with `rustc --version`. |
| `wasm32-unknown-unknown` target | — | Required to compile Soroban contracts to WASM. Add with `rustup target add wasm32-unknown-unknown`. |
| [Soroban CLI](https://soroban.stellar.org/docs/getting-started/setup) | 21.x | Needed to build/inspect Soroban contracts locally. Install via the Stellar docs. |
| [Freighter](https://freighter.app) | latest | Browser wallet extension for signing Stellar transactions. Used by the editor's deploy flow. |

You do **not** need Soroban CLI or the WASM target to run the frontend editor or its tests — those are only required to build the Soroban smart contracts in `contracts/`. The frontend talks to the Rust backend, which performs the actual compilation.

---

## Local Development Setup

This walkthrough takes you from a fresh clone to a running editor at `http://localhost:3000`. None of the environment variables are required for local development — they all have sensible defaults — so you can run the frontend immediately after installing dependencies.

### 1. Fork and clone

Fork the repository on GitHub, then clone your fork:

```bash
git clone https://github.com/<YOUR_USERNAME>/lumens-block.git
cd lumens-block

# Add the upstream repo as a remote so you can keep your fork in sync
git remote add upstream https://github.com/OpenCloudz/lumens-block.git
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Open Editor** to start building. The editor lives at `/editor`.

At this point you have a working visual editor. You can drag blocks, connect them, configure them, and generate Soroban Rust source code. Deploying a contract requires the backend and a funded Freighter account — see [Testnet Setup](#testnet-setup-freighter).

### 4. (Optional) Start the Rust backend

The backend compiles generated Rust source into Soroban WASM and submits deploy transactions to Stellar. The frontend falls back to its own API routes if the backend is unavailable, so it is optional for UI work.

```bash
cd backend
cargo run        # starts the API on http://localhost:8080
```

Verify it is running:

```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

### 5. (Optional) Build the Soroban contracts

Only needed if you are working on the smart contract workspace:

```bash
rustup target add wasm32-unknown-unknown   # first time only
cd contracts
cargo build --target wasm32-unknown-unknown --release
```

### 6. (Optional) Run the docs site

The project ships a documentation site (built with Nextra) in `docs/`:

```bash
cd docs
npm install
npm run dev
```

---

## Project Architecture

LumensBlock is a visual, no-code platform for building Soroban smart contracts on Stellar. Users compose contract logic on a drag-and-drop canvas, the app generates valid Rust source from that graph, compiles it to WASM via the backend, and deploys it to the Stellar network through the Freighter wallet.

### Repository layout

```
lumens-block/
├── frontend/          # Next.js web application (landing page + visual editor)
│   └── src/
│       ├── app/                  # Next.js App Router (pages + API routes)
│       │   ├── page.tsx          # Landing page
│       │   ├── editor/           # /editor route — the block editor
│       │   └── api/             # Server-side API routes (compile, invoke, simulate, test)
│       ├── components/
│       │   ├── editor/           # Block editor UI (React Flow nodes, toolbar, panels)
│       │   └── landing/          # Landing page components
│       └── lib/
│           ├── compile/          # Graph → Soroban Rust source codegen + validation
│           ├── compiler/         # Compiler helpers
│           ├── editor/           # Editor logic (e.g. undo/redo history)
│           ├── stellar/          # Stellar SDK integration (deploy, simulate, network config)
│           └── templates/        # Built-in contract templates (JSON)
├── backend/           # Rust + Axum service (contract compilation & deployment API)
├── contracts/         # Soroban smart contract workspace (Rust + Soroban SDK)
├── docs/              # Nextra documentation site
└── .github/           # CI workflows
```

### How the pieces fit together

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (Next.js app)                                              │
│                                                                     │
│  React Flow canvas  ──►  Graph (nodes + edges)                      │
│        │                       │                                     │
│        ▼                       ▼                                     │
│  Drag / configure     validate.ts  (cycle + type checks)            │
│                               │                                     │
│                               ▼                                     │
│                       codegen.ts  ──►  Soroban Rust source           │
│                               │                                     │
│                               ▼                                     │
│              POST /api/compile  ──►  Rust backend /compile          │
│                                                     │                │
│                          WASM (base64) ◄────────────┘                │
│                               │                                     │
│                               ▼                                     │
│                    deploy.ts  builds deploy transaction              │
│                               │                                     │
│                               ▼                                     │
│                  Freighter signs the transaction XDR                │
│                               │                                     │
│                               ▼                                     │
│              Submit to Stellar network (Soroban RPC)                │
│                               │                                     │
│                               ▼                                     │
│                       Contract deployed → contract ID               │
└─────────────────────────────────────────────────────────────────────┘
```

The flow, step by step:

1. **Edit** — The user drags blocks (e.g. `Function`, `Condition`, `Auth`) from the toolbar onto a React Flow canvas and connects them to express contract logic. The graph is persisted to `localStorage`.
2. **Validate** — `src/lib/compile/validate.ts` checks the graph for cycles, missing connections, and type mismatches before code generation.
3. **Codegen** — `src/lib/compile/codegen.ts` translates the validated graph into Soroban Rust source code.
4. **Compile** — The frontend POSTs the generated source to its own Next.js API route (`/api/compile`), which forwards it to the Rust backend. The backend compiles the Rust source to a Soroban WASM binary (returned as base64).
5. **Sign** — `src/lib/stellar/deploy.ts` constructs the deploy transaction and asks Freighter to sign it.
6. **Deploy** — The signed transaction is submitted to the Stellar network via Soroban RPC, and the resulting contract ID is returned to the editor.

The frontend and contracts do not share code directly. The frontend **generates** Rust source text; the backend **compiles** it. The `contracts/` workspace is a standalone Soroban contract crate used as a reference/starting point.

### Key files for common contributions

| File | What it controls |
|---|---|
| `frontend/src/lib/compile/schema.ts` | Block type definitions and graph schema |
| `frontend/src/lib/compile/codegen.ts` | Block → Soroban Rust code generation |
| `frontend/src/lib/compile/validate.ts` | Graph validation rules (cycles, types) |
| `frontend/src/lib/compile/cycle.ts` | Cycle detection |
| `frontend/src/lib/compile/typeInference.ts` | Type inference for block ports |
| `frontend/src/lib/stellar/deploy.ts` | Deployment, fee estimation, and network config |
| `frontend/src/lib/templates/` | Built-in contract templates (JSON) |
| `frontend/src/components/editor/` | Visual editor UI components |
| `backend/src/handlers/` | Backend API handlers (compile, deploy, health, invoke) |

---

## Environment Variables

All environment variables have defaults, so local development works without any `.env` file. Set them only when you need to override a default (e.g. point at a different backend or network).

For the frontend, create a `frontend/.env.local` file (this file is git-ignored) to override values. Never commit secrets or real keys.

### Client-side (`NEXT_PUBLIC_*` — exposed to the browser)

These are prefixed with `NEXT_PUBLIC_` so Next.js inlines them into the client bundle.

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | The Stellar network the editor deploys to. Accepts `testnet` or `mainnet`. | `testnet` |

### Server-side (Next.js API routes — not exposed to the browser)

These are read on the server in the Next.js API routes under `frontend/src/app/api/`.

| Variable | Description | Default |
|---|---|---|
| `BACKEND_URL` | Base URL of the Rust backend service, used by the compile/invoke API routes. | `http://localhost:8080` |
| `STELLAR_RPC_URL` | Soroban RPC URL used by the simulate route. | `https://soroban-testnet.stellar.org` |

### Backend (Rust service)

These configure the Rust backend in `backend/`. Set them in the environment where you run `cargo run` (or in your shell/Docker).

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port the backend listens on. | `8080` |
| `CARGO` | Path to the `cargo` binary used for compilation. | `cargo` |
| `COMPILE_TIMEOUT_SECS` | Maximum compilation time in seconds. | `30` |
| `MAX_SOURCE_BYTES` | Maximum allowed source code size in bytes. | `65536` |
| `COMPILE_CPU_SECS` | CPU time limit for the `cargo` subprocess on Linux (seconds). | `20` |
| `COMPILE_MEM_MB` | Virtual memory limit for the `cargo` subprocess on Linux (MB). | `1024` |
| `COMPILE_WORK_DIR` | Base directory for compilation workspaces. | `/tmp/lumens-compile` |
| `STELLAR_RPC_TESTNET` | Custom Soroban RPC Testnet URL. | `https://soroban-testnet.stellar.org` |
| `STELLAR_RPC_MAINNET` | Custom Soroban RPC Mainnet URL. | `https://soroban.stellar.org` |

### Playwright / CI

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port the Next.js dev server uses during E2E tests (Playwright config). | `3005` |
| `CI` | When set, Playwright fails on skipped tests, retries once, and limits workers. | unset |

---

## Running Tests

### Frontend unit tests (Vitest)

```bash
cd frontend
npm test              # run once
npm run test:watch    # watch mode
```

Unit tests live alongside the code they cover, e.g. `frontend/src/lib/compile/__tests__/` and `frontend/src/lib/editor/__tests__/`.

### Frontend type-checking and lint

CI runs these on every PR, so run them locally before submitting:

```bash
cd frontend
npx tsc --noEmit      # TypeScript type check (strict mode)
npm run lint          # ESLint (next/core-web-vitals)
```

### Frontend end-to-end tests (Playwright)

E2E tests are in `frontend/e2e/` and cover the editor UI: landing page navigation, drag-and-drop, node connections, config panels, graph persistence, undo/redo, and more.

```bash
cd frontend

# Install Playwright browsers (first time only)
npx playwright install --with-deps chromium

# Run all E2E tests (starts the Next.js dev server automatically)
npm run test:e2e

# Open the interactive Playwright UI
npm run test:e2e:ui
```

### Backend tests (Rust)

```bash
cd backend
cargo test
```

### Contract tests

```bash
cd contracts
cargo test
```

### CI

The CI pipeline (`.github/workflows/ci.yml`) runs on every push and pull request to `main`. For the frontend it runs lint, type-check, unit tests, and E2E tests. For the backend it runs `cargo check` and `cargo test`. Make sure these pass locally before opening a PR.

---

## Code Style

### TypeScript / Frontend

- **All new code is TypeScript.** No plain `.js` files in `frontend/src/`.
- **Strict mode is enabled** (`"strict": true` in `frontend/tsconfig.json`). New code must be fully typed — avoid `any`; use proper types and interfaces.
- **ESLint** uses `next/core-web-vitals` (see `frontend/.eslintrc.json`). Run `npm run lint` and fix all errors before committing.
- **Prettier is not currently configured.** If you add it, keep formatting changes in a separate commit from logic changes so reviews stay focused.
- Use the existing `BlockType` union from `schema.ts` when referencing block types — don't hardcode strings.
- Components go in `frontend/src/components/`; pure logic goes in `frontend/src/lib/`.
- Styling uses Tailwind CSS — no inline styles or new CSS files unless necessary.
- New block logic belongs in `codegen.ts` (the `emitBlock` switch) and `validate.ts`.

### Rust / Backend & Contracts

- Run `cargo fmt` before committing.
- Run `cargo clippy` and address warnings.
- Keep generated Soroban source in `codegen.ts`; don't duplicate logic in the Rust backend.

---

## Commit Conventions

LumensBlock follows the [Conventional Commits](https://www.conventionalcommits.org) format. Each commit message should be structured as:

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

### Types

| Type | Use for |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `style` | Code style/formatting (no logic change) |
| `refactor` | Code refactoring (no feature/fix) |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `build` | Build system or dependency changes |
| `ci` | CI configuration changes |
| `chore` | Routine tasks, tooling, maintenance |
| `revert` | Reverting a previous commit |

### Examples

```
feat: add Condition block branching to codegen
fix(editor): correct Auth block parameter derivation
docs: add Mainnet deployment steps to CONTRIBUTING
refactor(compile): extract cycle detection into its own module
test: cover localStorage persistence for the canvas
chore: update soroban-sdk to 21.1.0
ci: cache Cargo registry in backend job
```

A commit that addresses a GitHub issue should reference it in the footer so the issue is linked:

```
feat(editor): implement undo/redo history

Adds a graph-state history stack with keyboard shortcuts (Ctrl/Cmd+Z,
Ctrl/Cmd+Shift+Z).

Closes #122
```

> Tip: Using `Closes #<issue-number>` (or `Fixes #<issue-number>`) in the commit body or PR description automatically closes the issue when the change lands on `main`.

---

## Pull Request Process

### 1. Create a branch

Branch from the latest `main` with a descriptive name using one of these prefixes:

```bash
git checkout main
git pull upstream main
git checkout -b feat/my-feature       # new feature
git checkout -b fix/block-connection  # bug fix
git checkout -b docs/update-guide     # documentation
```

### 2. Make focused changes

- One feature or fix per pull request.
- Follow the [code style](#code-style) above.
- Write [Conventional Commit](#commit-conventions) messages.
- For larger changes (new block types, architecture changes, new dependencies), open an issue first to discuss the approach.

### 3. Test before submitting

```bash
cd frontend
npm test
npx tsc --noEmit
npm run lint
npm run test:e2e   # optional, but recommended for editor changes
```

All checks must pass. The CI pipeline runs the same checks on every PR.

### 4. Open a pull request

- Target the `main` branch.
- Keep the title concise (under 70 characters) and in the Conventional Commits format, e.g. `feat: add Condition block branching`.
- In the description, explain **what** changed, **why**, and **how** you tested it.
- Reference the issue your PR closes (e.g. `Closes #89`) in the description.

### PR checklist

- [ ] `npm test` passes locally
- [ ] `npx tsc --noEmit` passes (no type errors)
- [ ] `npm run lint` passes (no ESLint errors)
- [ ] Backend changes pass `cargo test`
- [ ] New block types are documented in `docs/pages/block-reference.md`
- [ ] Deployment-related changes are reflected in `docs/pages/deployment-guide.md`
- [ ] No secrets, API keys, or `.env` files are committed

### Review and merge

- A maintainer will review your PR. Please respond to feedback and update your branch as needed.
- Keep your branch up to date with `main`:
  ```bash
  git fetch upstream
  git rebase upstream/main
  ```
- Once approved and CI is green, a maintainer will merge your PR. We typically use squash merges, so your PR title becomes the merge commit message — keep it meaningful.

---

## Testnet Setup (Freighter)

To deploy contracts from the editor, you need a funded Stellar account in the Freighter wallet. For local development and testing, use the Stellar **Testnet** — it is free and funded by Friendbot.

### 1. Install Freighter

Install the [Freighter](https://freighter.app) browser extension (available for Chrome, Firefox, and other Chromium-based browsers).

### 2. Create a wallet

Open the Freighter extension and follow the onboarding flow to create a new wallet. **Save your recovery phrase securely** — it is the only way to recover your account.

### 3. Switch to Testnet

In Freighter, open the network selector and choose **Testnet**. This ensures the editor's default network (`NEXT_PUBLIC_STELLAR_NETWORK=testnet`) matches your wallet.

### 4. Fund your account with Friendbot

Testnet accounts need test XLM to pay for transactions. Fund your account for free using the [Stellar Laboratory Account Creator (Friendbot)](https://laboratory.stellar.org/#account-creator):

1. Copy your public key from Freighter.
2. Open the [Stellar Laboratory Account Creator](https://laboratory.stellar.org/#account-creator).
3. Select **Testnet** as the network.
4. Paste your public key and click **Create Account** (Friendbot will send you 10,000 test XLM).

Alternatively, you can fund programmatically — replace `<PUBLIC_KEY>` with your Freighter public key:

```bash
curl "https://friendbot.stellar.org/?addr=<PUBLIC_KEY>"
```

### 5. Verify your balance

Check your funded balance on the [Stellar Explorer (Testnet)](https://stellar.expert/explorer/testnet) by pasting your public key, or look at the balance inside the Freighter extension.

You are now ready to deploy contracts from the LumensBlock editor to Testnet.

---

## Reporting Bugs & Feature Requests

### Reporting bugs

Open an [issue](https://github.com/OpenCloudz/lumens-block/issues) with:

- A clear title describing the problem.
- Steps to reproduce (include the block graph if relevant — use **Export JSON** in the editor).
- Expected vs actual behaviour.
- Browser, OS, and Freighter version.
- Screenshots or console errors if available.

### Feature requests

Open an issue tagged `enhancement` and describe the use case. We prioritise features that align with the no-code / visual-first philosophy of LumensBlock and that lower the barrier to deploying on Stellar.

### Questions

The best place to ask questions is on a relevant [issue](https://github.com/OpenCloudz/lumens-block/issues). Open a new issue tagged with a `question` label, or comment on an existing one related to your topic.

---

Thank you for contributing to LumensBlock! 🚀
