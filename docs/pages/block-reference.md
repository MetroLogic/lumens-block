---
title: Block Reference
---

# Block Reference

Every contract in LumensBlock is a graph of **blocks** connected by edges. Execution flows from the **Start** block through each connected block in breadth-first order.

A graph can instead declare **named functions**: tag a subgraph with a `FunctionEntry` block and the compiler emits a separate `pub fn` for it, so one contract can expose `deposit()`, `withdraw()` and `get_balance()` from a single deployment. Graphs with no `FunctionEntry` keep compiling to the single `execute()` entry point exactly as before.

There are **9 block types**. Each section below covers what the block does, its configuration fields, the Soroban code it generates, and an example use case.

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

**Config fields:**

| Field | Required | Description |
|---|---|---|
| `asset` | no | Asset selector in the visual editor. Choose **Native XLM** (no address needed) or **Custom SAC token** and enter a Stellar Asset Contract address. On Testnet, a valid SAC address fetches and displays the token `symbol` / `name`. Stored as `params.asset` (`kind`, `contractId`, `symbol`, `name`) and synced to `params.token`. |

| Generated parameter | Rust type | Description |
|---|---|---|
| `from` | `Address` | Sender address |
| `to` | `Address` | Recipient address |
| `amount` | `i128` | Amount in stroops (1 XLM = 10,000,000 stroops) |
| `token` | `Address` | Token contract address (defaults from the block's asset selection when simulating or testing) |

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

Gates execution on a boolean parameter. If the condition is not met the contract panics with the generated `GeneratedError::ConditionFailed` contract error.

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
    panic_with_error!(&env, GeneratedError::ConditionFailed);
}
```

Graphs containing a Condition block also emit the error type the guard panics with:

```rust
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GeneratedError {
    /// A Condition block guard evaluated to false.
    ConditionFailed = 1,
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

## Cross-Contract Call

Invokes a function on another already-deployed Soroban contract and, optionally, binds the
result to a name that downstream blocks can read.

**Config fields:**

| Field | Required | Description |
|---|---|---|
| `targetContractId` | yes | Address of the deployed contract to call. Compilation fails with `MISSING_TARGET_CONTRACT` when empty. |
| `targetFunction` | yes | Name of the function to invoke. Compilation fails with `MISSING_TARGET_FUNCTION` when empty. |
| `targetArgs` | no | Ordered argument list. Each argument has a `name`, a `rustType` (`Address`, `i128`, `Symbol` or `bool`) and a value `source`: `literal`, `storageKey` (read from instance storage) or `invocationArg` (an `execute` parameter). |
| `returnBinding` | no | Name the return value is bound to. When set, the name is selectable as an **Argument** operand in downstream Condition blocks. |
| `returnType` | no | Rust type of the bound return value. Defaults to `i128`. |

Pasting or uploading the target contract's JSON ABI in the config panel turns the function
field into a selector and pre-fills the argument slots with the declared types. Arguments
whose configured type diverges from the ABI are flagged inline.

| Generated parameter | Rust type | Description |
|---|---|---|
| `target_contract` | `Address` | Address the call is made against (`target_contract_2`, `target_contract_3`, … for further Cross-Contract Call blocks) |
| *argument names* | *as configured* | Every argument sourced from an `invocationArg` that no other block already declares |

**Generated Soroban code** (target `stake`, arguments `caller`/`amount`, bound to `stake_result`):
```rust
#[soroban_sdk::contractclient(name = "CrossContract1Client")]
pub trait CrossContract1 {
    // Target contract: CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ
    fn stake(env: Env, caller: Address, amount: i128) -> i128;
}
```
```rust
// Stake Pool → stake()
let stake_result: i128 = CrossContract1Client::new(&env, &target_contract).stake(&caller, &amount);
```

**Example use case:** Stake a user's deposit into an external pool contract and abort the
transaction unless the pool reports a non-zero staked amount.

```
Start → Auth → Cross-Contract Call → Condition → Event
```
## Function Entry

Marks the root of a named function subgraph. A graph containing one or more `FunctionEntry` blocks compiles to one `pub fn` per entry, all inside the same `#[contractimpl] impl` block, instead of a single `execute()`.

**Config fields:**

| Field | Description |
|---|---|
| `functionName` | The emitted Rust function name. Must match `/^[a-z_][a-z0-9_]*$/`. |
| `visibility` | `pub` (default) or `pub(crate)`. |
| `functionParams` | Up to 10 `{ name, rustType }` pairs, emitted in order after `env`. |

`env: Env` is always the first parameter and does not need declaring. Any parameter a body block relies on implicitly — `caller` for Auth, `from`/`to`/`amount`/`token` for Transfer, and so on — is appended automatically if you did not declare it.

**Validation errors:**

| Code | Cause |
|---|---|
| `MISSING_FUNCTION_NAME` | The entry has no name. |
| `INVALID_FUNCTION_NAME` | The name is not a valid Rust identifier. |
| `DUPLICATE_FUNCTION_NAME` | Two entries declare the same name. |
| `TOO_MANY_FUNCTION_PARAMS` | More than 10 declared parameters. |
| `INVALID_PARAM_NAME` / `RESERVED_PARAM_NAME` / `DUPLICATE_PARAM_NAME` | Bad parameter name, or one called `env`. |
| `INVALID_PARAM_TYPE` | The Rust type contains characters no type can contain, or unbalanced brackets. |
| `MISSING_FUNCTION_RETURN` | No `FunctionReturn` is reachable from the entry. |
| `MULTIPLE_FUNCTION_RETURNS` | More than one `FunctionReturn` is reachable. |
| `SHARED_FUNCTION_BLOCK` | A block is reachable from two different entries. |

**Generated Soroban code:**
```rust
/// Generated from FunctionEntry "deposit".
pub fn deposit(env: Env, amount: i128, caller: Address) -> i128 {
    // Require caller
    caller.require_auth();

    amount
}
```

**Example use case:** A vault contract exposing `deposit`, `withdraw` and `get_balance` as three separate callable functions on one deployed contract, rather than three separate deployments.

---

## Function Return

Terminates a function subgraph and declares what the function returns. Every `FunctionEntry` needs exactly one reachable `FunctionReturn`; nothing downstream of a return belongs to that function.

**Config fields:**

| Field | Description |
|---|---|
| `returnType` | Rust return type, e.g. `i128`, `bool`, `()`. Defaults to `()`. |
| `returnValue` | Expression to return. Optional — a zero value for the declared type is emitted when it is left empty. |

**Validation errors:** `INVALID_RETURN_TYPE` for a malformed type, and `ORPHAN_FUNCTION_RETURN` when no `FunctionEntry` can reach the block.

**Generated Soroban code:** the return type joins the signature and the value becomes the function's trailing expression.

**Example use case:** Ending a `get_balance` subgraph with `returnType: i128` so callers receive the stored balance.

---

## Block Limits

| Limit | Value |
|---|---|
| Maximum nodes per graph | 100 |
| Maximum edges per graph | 200 |
| Maximum graph payload size | 256 KiB |
| Maximum `storageKey` length | 9 characters |
| Maximum parameters per `FunctionEntry` | 10 |

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
