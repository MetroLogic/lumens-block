---
title: Block Reference
---

# Block Reference

Every contract in LumensBlock is a graph of **blocks** connected by edges. Execution flows from the **Start** block through each connected block in breadth-first order.

There are **6 block types**. Each section below covers what the block does, its configuration fields, the Soroban code it generates, and an example use case.

---

## Start (default)

The entry point of every contract. Every graph must have exactly one Start block.

**Config fields:** none — it is a marker node only.

**Generated code:** no code is emitted; it seeds the execution order traversal.

**Example:** Drop a Start block and connect it to an Auth block to begin an authenticated flow.

---

## Auth

Requires the `caller` address to have signed the transaction. Guards every downstream block from being called by unauthorised accounts.

**Config fields:** none — the block emits `caller.require_auth()` using the implicit `caller: Address` parameter derived from the graph.

| Generated parameter | Rust type | Description |
|---|---|---|
| `caller` | `Address` | The account that must sign the transaction |

**Generated Soroban code:**
```rust
// Auth Check
caller.require_auth();
```

**Example use case:** Protect a token transfer so only the `caller` (e.g. a contract owner) can trigger it. Place an Auth block directly after Start.

```
Start → Auth → Transfer
```

---

## Transfer

Executes a token transfer between two addresses via the Stellar token interface.

**Config fields:** none in the visual editor — all values are passed as function parameters at call time.

| Generated parameter | Rust type | Description |
|---|---|---|
| `from` | `Address` | Sender address |
| `to` | `Address` | Recipient address |
| `amount` | `i128` | Amount in stroops (1 XLM = 10,000,000 stroops) |
| `token` | `Address` | Token contract address |

**Generated Soroban code:**
```rust
// Transfer Tokens
token::Client::new(&env, &token).transfer(&from, &to, &amount);
```

**Example use case:** Send XLM from a user to a vault address as part of an escrow deposit. Combine with an Auth block to ensure only the depositor can call it.

```
Start → Auth → Transfer → Event
```

---

## Storage

Reads or writes a value to the contract's on-chain instance storage.

**Config fields:**

| Field | Required | Description |
|---|---|---|
| `storageKey` | no | A short identifier for the storage slot (max 9 alphanumeric characters). Defaults to `stored` if left empty. Special characters are replaced with `_`. |

| Generated parameter | Rust type | Description |
|---|---|---|
| `key` | `Symbol` | Runtime key (can differ from the block's `storageKey`) |
| `value` | `i128` | The integer value to store |

**Generated Soroban code** (with `storageKey = "balance"`):
```rust
// Lock Funds
env.storage().instance().set(&symbol_short!("balance"), &value);
```

**Example use case:** Lock a deposited amount in escrow by storing it keyed by `"balance"`. Later, a Condition block gates the Transfer that releases it.

```
Start → Auth → Storage → Condition → Transfer
```

---

## Condition

Gates execution on a boolean parameter. If the condition is not met the contract panics with `symbol_short!("cond")`.

**Config fields:**

| Field | Required | Description |
|---|---|---|
| `condition` | no | A human-readable label for the condition shown in the editor (e.g. `"Release approved?"`). Does not affect generated code. |

| Generated parameter | Rust type | Description |
|---|---|---|
| `release` | `bool` | Pass `true` to continue execution; `false` aborts the transaction |

**Generated Soroban code:**
```rust
// Release Condition Met?
if !release {
    panic_with_error!(&env, symbol_short!("cond"));
}
```

**Example use case:** In a simple escrow, the contract owner calls the function with `release = true` once the off-chain condition (e.g. delivery confirmation) is satisfied.

---

## Event

Publishes an on-chain event that off-chain indexers and dApps can subscribe to.

**Config fields:** none in the visual editor — the event name is passed as a function parameter.

| Generated parameter | Rust type | Description |
|---|---|---|
| `event_name` | `Symbol` | Topic for the event |
| `from` | `Address` | Emitted in the event payload |
| `to` | `Address` | Emitted in the event payload |
| `amount` | `i128` | Emitted in the event payload |

**Generated Soroban code:**
```rust
// Emit Transfer Event
env.events().publish((event_name,), (from.clone(), to.clone(), amount));
```

**Example use case:** Emit a `transferred` event after a Token Transfer block so a frontend dApp can listen and update the UI in real time.

---

## Block Limits

| Limit | Value |
|---|---|
| Maximum nodes per graph | 100 |
| Maximum edges per graph | 200 |
| Maximum graph payload size | 256 KiB |
| Maximum `storageKey` length | 9 characters |

---

## Built-in Templates

LumensBlock ships three templates to help you get started quickly:

### Token Transfer
`Start → Auth → Transfer → Event`

Authenticated transfer with an on-chain event. Good starting point for any payment flow.

### Simple Escrow
`Start → Auth → Storage → Condition → Transfer`

Deposits funds into storage and releases them when the caller passes `release = true`.

### Access-Controlled Storage
`Start → Auth → Storage`

Writes a value to contract storage, guarded by an auth check. Use as a base for any key-value store contract.
