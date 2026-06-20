---
title: Contributing
---

# Contributing to LumensBlock

LumensBlock is open source under the MIT licence. Contributions of all sizes are welcome — from typo fixes to new block types.

---

## Before You Start

- Check [open issues](https://github.com/metro-logic/lumens-block/issues) to avoid duplicating work.
- For significant changes (new block types, architecture changes, new dependencies), open an issue first to discuss the approach.
- Keep pull requests focused: one feature or fix per PR.

---

## Development Setup

### 1. Fork and clone

```bash
git clone https://github.com/YOUR_USERNAME/lumens-block.git
cd lumens-block
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # starts Next.js at http://localhost:3000
```

Run tests and type-check before submitting:

```bash
npm test           # vitest unit tests
npx tsc --noEmit   # TypeScript type check
npm run lint       # ESLint
```

### 3. Backend (Rust API)

```bash
cd backend
cargo check        # verify it compiles
cargo run          # start the compile API
```

### 4. Soroban contracts

```bash
cd contracts
cargo build --target wasm32-unknown-unknown --release
```

Requires the `wasm32-unknown-unknown` target:
```bash
rustup target add wasm32-unknown-unknown
```

---

## Project Structure

```
lumens-block/
├── frontend/                     # Next.js app
│   └── src/
│       ├── app/                  # Next.js app router pages
│       ├── components/
│       │   ├── editor/           # Block editor components (React Flow)
│       │   └── landing/          # Landing page components
│       └── lib/
│           ├── compile/          # Graph → Rust source codegen + validation
│           ├── stellar/          # Stellar SDK: deploy, simulate, test
│           └── templates/        # Built-in contract templates (JSON)
├── backend/                      # Rust compile API
├── contracts/                    # Soroban smart contract workspace
└── docs/                         # This documentation site (Docusaurus)
```

### Key files for common contributions

| File | What it controls |
|---|---|
| `frontend/src/lib/compile/schema.ts` | Block type definitions and graph schema |
| `frontend/src/lib/compile/codegen.ts` | Block → Soroban Rust code generation |
| `frontend/src/lib/compile/validate.ts` | Graph validation rules |
| `frontend/src/lib/stellar/deploy.ts` | Deployment and fee estimation logic |
| `frontend/src/lib/templates/` | Built-in templates (JSON) |
| `frontend/src/components/editor/` | Visual editor UI components |

---

## Contribution Workflow

### 1. Create a branch

Branch from `main` with a descriptive name:

```bash
git checkout main
git pull origin main
git checkout -b feat/my-feature     # new feature
git checkout -b fix/block-connection # bug fix
git checkout -b docs/update-guide   # documentation
```

### 2. Make your changes

Follow the coding conventions below. Keep commits focused and use conventional commit messages:

```
feat: add Condition block branching to codegen
fix: correct Auth block parameter derivation
docs: add Mainnet deployment steps
chore: update soroban-sdk to 21.1.0
```

### 3. Test your changes

```bash
cd frontend
npm test
npx tsc --noEmit
npm run lint
```

All checks must pass before opening a PR. The CI pipeline runs the same checks on every PR.

### 4. Open a pull request

- Target the `main` branch.
- Title: concise, under 70 characters.
- Description: explain what changed, why, and how you tested it.
- Check the PR checklist (see below).

---

## PR Checklist

When you open a PR, confirm the following:

- [ ] `npm test` passes locally
- [ ] `npx tsc --noEmit` passes (no type errors)
- [ ] `npm run lint` passes (no ESLint errors)
- [ ] New block types are documented in `docs/docs/block-reference.md`
- [ ] New templates are listed in `docs/docs/block-reference.md` under Built-in Templates
- [ ] Deployment-related changes are reflected in `docs/docs/deployment-guide.md`
- [ ] No secrets, API keys, or `.env` files are committed

---

## Coding Conventions

### TypeScript / Frontend

- All new code in TypeScript (no plain `.js` files in `src/`).
- Use the existing `BlockType` union from `schema.ts` when referencing block types — don't hardcode strings.
- New block logic belongs in `codegen.ts` (`emitBlock` switch) and `validate.ts`.
- Components go in `src/components/`; pure logic goes in `src/lib/`.
- Tailwind CSS for styling — no inline styles, no new CSS files unless necessary.

### Rust / Backend & Contracts

- Run `cargo fmt` before committing.
- Run `cargo clippy` and address warnings.
- Keep generated Soroban source in `codegen.ts`; don't duplicate logic in the Rust backend.

### Adding a New Block Type

1. Add the type string to `BLOCK_TYPES` in `schema.ts`.
2. Add parameter derivation in `deriveParams` and `deriveImports` in `codegen.ts`.
3. Add a case to `emitBlock` in `codegen.ts`.
4. Add validation rules in `validate.ts` if needed.
5. Add a test in `frontend/src/lib/compile/__tests__/`.
6. Document the block in `docs/docs/block-reference.md` with config fields, generated parameters, generated code, and an example use case.

### Adding a New Template

1. Create a JSON file in `frontend/src/lib/templates/` following the `ContractGraph` schema.
2. Export it from `frontend/src/lib/templates/index.ts`.
3. Add it to `docs/docs/block-reference.md` under Built-in Templates.

---

## Reporting Bugs

Open an issue with:

- A clear title describing the problem
- Steps to reproduce (include the block graph if relevant — use **Export JSON** in the editor)
- Expected vs actual behaviour
- Browser, OS, and Freighter version
- Screenshots or console errors if available

---

## Feature Requests

Open an issue tagged `enhancement`. Describe the use case and how it fits LumensBlock's no-code / visual-first philosophy. We prioritise features that lower the barrier to deploying on Stellar.

---

## Questions

Open a [GitHub Discussion](https://github.com/metro-logic/lumens-block/discussions) or comment on a relevant issue.
