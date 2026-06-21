---
title: Deployment Guide
---

# Deployment Guide

LumensBlock compiles your visual block graph to a Soroban WebAssembly contract and deploys it to Stellar using your connected Freighter wallet. This guide covers both Testnet and Mainnet deployments.

---

## How Deployment Works

When you click **Deploy Contract**, LumensBlock:

1. Serialises your canvas to a `ContractGraph` JSON payload.
2. Sends the payload to the compile API, which generates Rust source and builds a `.wasm` binary.
3. Calls `estimateDeploymentFee` to simulate the upload and deployment transactions.
4. Shows you a confirmation dialog with the estimated fee and your wallet balance.
5. On confirmation, signs and submits the transactions via Freighter.

---

## Testnet Deployment

Testnet is Stellar's public sandbox — transactions are free (using Friendbot XLM) and have no real-world value. Always test here before going to Mainnet.

### Prerequisites

- Freighter wallet installed and **set to Testnet**.
- Testnet XLM balance (minimum ~10 XLM is enough for most contracts).

### Fund your Testnet wallet

Visit the [Stellar Friendbot](https://laboratory.stellar.org/#account-creator?network=test) and paste your wallet address. Click **Get Test XLM** to receive 10,000 XLM.

### Deploy steps

1. Open the editor at [http://localhost:3000/editor](http://localhost:3000/editor) (or the hosted app).
2. Build your contract on the canvas, or load a template from the **Templates** button.
3. Click **Connect Wallet** and approve in Freighter. Verify the network badge shows **Testnet**.
4. Click **Deploy Contract**.
5. Review the confirmation dialog:
   - **Estimated fee** — the XLM cost of uploading and deploying the WASM.
   - **Wallet balance** — your current Testnet balance.
   - If balance is insufficient, a warning shows the shortfall.
6. Click **Confirm & Sign** and approve the two transactions in Freighter (upload WASM + deploy contract).
7. On success, the contract address is displayed in the editor.

---

## Mainnet Deployment

> **⚠️ Real funds:** Mainnet transactions use real XLM and are irreversible. Thoroughly test your contract on Testnet before deploying to Mainnet.

### Prerequisites

- Freighter wallet **set to Mainnet (Public Network)**.
- Sufficient XLM balance for fees (usually 1–5 XLM depending on contract size).
- Contract tested and validated on Testnet.

### Switch Freighter to Mainnet

1. Open the Freighter extension.
2. Click the network selector (top of the popup).
3. Select **Mainnet (Public Network)**.

### Deploy steps

1. In the LumensBlock editor, change the **network selector** in the toolbar from **Testnet** to **Mainnet**.
2. Ensure your Freighter wallet is also set to Mainnet (they must match).
3. Click **Deploy Contract**.
4. Review the fee estimate carefully — Mainnet fees reflect real XLM cost.
5. Click **Confirm & Sign** and approve in Freighter.

---

## Fee Estimation

The deployment fee covers two Stellar operations:

| Operation | Description |
|---|---|
| Upload WASM | Uploads the compiled contract binary to the Stellar ledger |
| Deploy contract | Instantiates the contract from the uploaded WASM |

Fees depend on the compiled WASM size (determined by which block types are used) and current network base fee. The editor shows an estimate before you confirm — actual fees may differ slightly.

---

## Troubleshooting

### "Connect your wallet before deploying"
Click **Connect Wallet** in the toolbar and approve the connection in Freighter.

### "Insufficient balance"
The confirmation dialog shows the exact shortfall. Add more XLM to your wallet (use Friendbot for Testnet).

### "Fix failing tests or enable override to deploy"
The **Tests** panel has detected a contract logic issue. Review the test results, fix the block graph, and re-run tests before deploying.

### Freighter transaction rejected
If you reject the Freighter popup, the deployment is cancelled. Click **Deploy Contract** again to restart.

### WASM compilation error
If the compile API returns an error, it will appear in red below the Deploy button. Common causes:
- A graph with no Start block.
- Disconnected blocks (blocks not reachable from Start).
- More than 100 nodes or 200 edges.

See [Block Reference — Block Limits](./block-reference#block-limits) for graph constraints.
