# LumensBlock

[![CI](https://github.com/metro-logic/lumens-block/actions/workflows/ci.yml/badge.svg)](https://github.com/metro-logic/lumens-block/actions/workflows/ci.yml)

**A visual drag-and-drop platform for building smart contracts and dApps on Stellar — no code required.**

Stack blocks, configure logic, and deploy directly to the Stellar network.

---

## What is LumensBlock?

LumensBlock removes the barrier between ideas and on-chain execution. Instead of writing Soroban smart contract code by hand, you assemble logic visually using a block-based editor and deploy with a single click.

It's designed for:
- **Developers** who want to prototype Stellar contracts faster
- **Non-developers** who want to build and deploy dApps without learning a new language
- **Teams** who want a shared visual layer for contract logic

---

## Features

- 🧩 **Drag-and-drop block editor** — compose contract logic visually
- 🚀 **One-click deployment** — deploy to Stellar Testnet or Mainnet
- 🔗 **dApp builder** — connect your contracts to a frontend interface
- 🔍 **No-code friendly** — no Rust or Soroban knowledge needed to get started

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js + TypeScript |
| Block Editor | React Flow |
| Smart Contracts | Rust + Soroban SDK |
| Stellar Integration | js-stellar-sdk |
| Wallet | Freighter API |
| Styling | Tailwind CSS |

---

## Repository Structure

```
lumens-block/
├── frontend/          # Next.js web application (landing page + visual editor)
├── backend/           # Rust backend service (contract compilation & deployment API)
├── contracts/         # Soroban smart contract workspace (Rust)
└── README.md
```

---

## Getting Started

**Prerequisites:** Node.js 18+, Rust + `wasm32-unknown-unknown` target, [Freighter wallet](https://freighter.app)

```bash
# Clone
git clone https://github.com/metro-logic/lumens-block.git
cd lumens-block
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev

# Run the unit test suite
npm test

# Run the Playwright end-to-end tests
# The Playwright config starts the local Next.js dev server automatically.
npm run test:e2e
```

Open [http://localhost:3000](http://localhost:3000) and click **Open Editor** to start building.

### Backend (Rust API)

```bash
cd backend

# Check the project compiles
cargo check

# Run the backend
cargo run
```

### Soroban Smart Contracts

```bash
cd contracts
cargo build --target wasm32-unknown-unknown --release
```

---

## Contributing

LumensBlock is open source and contributions are welcome!

### How to Contribute

1. **Fork** the repository and create your branch from `main`
2. **Make your changes** — keep commits focused and descriptive
3. **Test** your changes before submitting
4. **Open a pull request** with a clear description of what you changed and why

### Guidelines

- Follow the existing code style and conventions
- One feature or fix per pull request
- Write clear commit messages (e.g. `fix: correct block connection logic`)
- For larger changes, open an issue first to discuss the approach

### Reporting Bugs

Open an issue with:
- A clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if relevant

### Feature Requests

Open an issue tagged `enhancement` and describe the use case. We prioritize features that align with the no-code / visual-first philosophy of LumensBlock.

---

## License

MIT © [Metro Logic](https://github.com/metro-logic)
