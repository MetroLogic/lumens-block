---
title: Getting Started
---

# Getting Started

LumensBlock is a visual drag-and-drop platform for building Soroban smart contracts on Stellar — no Rust or coding experience required. This guide takes you from zero to a deployed contract on Testnet in minutes.

## Prerequisites

Before you start, make sure you have:

| Requirement | Version | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org) | 18+ | Run the frontend dev server |
| [Rust](https://rustup.rs) | stable | Build Soroban contracts locally (backend) |
| `wasm32-unknown-unknown` target | — | Compile contracts to WebAssembly |
| [Freighter Wallet](https://freighter.app) | latest | Sign and submit transactions |

### Install the Rust WASM target

```bash
rustup target add wasm32-unknown-unknown
```

### Install Freighter

Install the [Freighter browser extension](https://freighter.app). Create a wallet and **switch to Testnet** in the network settings before deploying.

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/metro-logic/lumens-block.git
cd lumens-block
```

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Start the backend (optional for local compilation)

The backend handles contract compilation. If you skip it, the editor falls back to the hosted compile API.

```bash
cd backend
cargo run
```

---

## Your First Contract

This walkthrough deploys a **Token Transfer** contract to Stellar Testnet using the built-in template.

### Step 1 — Open the editor

On the landing page, click **Open Editor**.

### Step 2 — Load the Token Transfer template

Click the **Templates** button in the toolbar. Select **Token Transfer** and click **Load Template**.

The canvas will populate with four connected blocks:

```
Start → Auth Check → Transfer Tokens → Emit Transfer Event
```

### Step 3 — Connect your wallet

Click **Connect Wallet** in the top-right toolbar. Approve the connection in the Freighter popup. Your wallet address and XLM balance will appear in the toolbar.

> **Testnet funds:** If your Testnet balance is 0, visit [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=test) to fund your address with 10,000 XLM.

### Step 4 — Deploy

1. Make sure the network selector shows **Testnet**.
2. Click **Deploy Contract**.
3. A confirmation dialog shows the estimated fee in XLM.
4. Click **Confirm & Sign** and approve the transaction in Freighter.

On success, the editor displays your contract's address on Stellar Testnet. 🎉

---

## Next Steps

- Read the [Block Reference](./block-reference) to understand every block type and its config fields.
- Follow the [Deployment Guide](./deployment-guide) for Mainnet deployment.
- Learn how to contribute in the [Contributing Guide](./contributing).
