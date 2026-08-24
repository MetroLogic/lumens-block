import { describe, expect, it, vi } from "vitest"
import { compileGraph, topologicalSort } from "../index"
import type { ContractGraph } from "../index"

describe("compileGraph", () => {
  it("maps Start node to the contract entry-point function signature", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "auth", type: "Auth", data: { label: "Require Auth" } },
      ],
      edges: [{ id: "e1", source: "start", target: "auth" }],
    }

    const code = compileGraph(graph)
    expect(code).toContain("pub fn execute(env: Env")
    expect(code).toContain("caller.require_auth();")
  })

  it("produces valid Soroban output for Transfer block type", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "transfer", type: "Transfer", data: { label: "Transfer XLM" } },
      ],
      edges: [{ id: "e1", source: "start", target: "transfer" }],
    }

    const code = compileGraph(graph)
    expect(code).toContain("token::Client::new(&env, &token).transfer(&from, &to, &amount);")
  })

  it("produces valid Soroban output for Condition block type", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "cond", type: "Condition", data: { label: "Check Release" } },
      ],
      edges: [{ id: "e1", source: "start", target: "cond" }],
    }

    const code = compileGraph(graph)
    expect(code).toContain("if !release {")
    expect(code).toContain("panic_with_error!(&env, GeneratedError::ConditionFailed);")
    expect(code).toContain("pub enum GeneratedError {")
  })

  it("produces valid Soroban output for Storage block type", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        {
          id: "storage",
          type: "Storage",
          data: { label: "Save Value", params: { storageKey: "balance" } },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "storage" }],
    }

    const code = compileGraph(graph)
    expect(code).toContain("env.storage().instance().set(&symbol_short!(\"balance\"), &value);")
  })

  it("produces valid Soroban output for Event block type", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        {
          id: "event",
          type: "Event",
          data: { label: "Emit Event", params: { eventName: "transferred" } },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "event" }],
    }

    const code = compileGraph(graph)
    expect(code).toContain("env.events().publish((event_name,), (from.clone(), to.clone(), amount));")
  })

  it("produces valid Soroban output for Auth block type", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "auth", type: "Auth", data: { label: "Require Auth" } },
      ],
      edges: [{ id: "e1", source: "start", target: "auth" }],
    }

    const code = compileGraph(graph)
    expect(code).toContain("caller.require_auth();")
  })

  it("performs topological sort and visits nodes in execution order", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "auth", type: "Auth", data: { label: "Auth" } },
        { id: "transfer", type: "Transfer", data: { label: "Transfer" } },
        { id: "event", type: "Event", data: { label: "Event" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "auth" },
        { id: "e2", source: "auth", target: "transfer" },
        { id: "e3", source: "transfer", target: "event" },
      ],
    }

    const orderedNodes = topologicalSort(graph)
    expect(orderedNodes.map((n) => n.id)).toEqual(["auth", "transfer", "event"])
  })

  it("detects cyclic graphs and throws an error with a clear message", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "n1", type: "Transfer", data: { label: "Node 1" } },
        { id: "n2", type: "Condition", data: { label: "Node 2" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "n1" },
        { id: "e2", source: "n1", target: "n2" },
        { id: "e3", source: "n2", target: "n1" }, // Cycle: n1 -> n2 -> n1
      ],
    }

    expect(() => compileGraph(graph)).toThrow("Cyclic graph detected: graph contains a cycle.")
  })

  it("triggers a warning for disconnected nodes without throwing an error", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "auth", type: "Auth", data: { label: "Auth" } },
        { id: "floating", type: "Storage", data: { label: "Disconnected Node" } },
      ],
      edges: [{ id: "e1", source: "start", target: "auth" }],
    }

    const warnings: string[] = []
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const code = compileGraph(graph, {
      onWarning: (msg) => warnings.push(msg),
    })

    expect(code).toContain("caller.require_auth();")
    expect(code).not.toContain("Disconnected Node")
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toContain("Disconnected node \"floating\"")
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})

describe("compileGraph — CrossContractCall", () => {
  const stakePoolGraph: ContractGraph = {
    nodes: [
      { id: "start", type: "default", data: { label: "Start" } },
      { id: "auth", type: "Auth", data: { label: "Require Auth" } },
      {
        id: "call",
        type: "CrossContractCall",
        data: {
          label: "Stake Pool",
          params: {
            targetContractId: "CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
            targetFunction: "stake",
            targetArgs: [
              { name: "caller", value: "caller", rustType: "Address", source: "invocationArg" },
              { name: "amount", value: "amount", rustType: "i128", source: "invocationArg" },
            ],
            returnBinding: "stake_result",
            returnType: "i128",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "auth" },
      { id: "e2", source: "auth", target: "call" },
    ],
  }

  it("emits the soroban_sdk client macro for a CrossContractCall node", () => {
    const code = compileGraph(stakePoolGraph)

    expect(code).toContain('#[soroban_sdk::contractclient(name = "CrossContract1Client")]')
    expect(code).toContain("pub trait CrossContract1 {")
    expect(code).toContain("fn stake(env: Env, caller: Address, amount: i128) -> i128;")
  })

  it("invokes the target contract through the generated client", () => {
    const code = compileGraph(stakePoolGraph)

    expect(code).toContain(
      "let stake_result: i128 = CrossContract1Client::new(&env, &target_contract).stake(&caller, &amount);"
    )
  })

  it("derives a target_contract parameter for the entry point", () => {
    const code = compileGraph(stakePoolGraph)

    expect(code).toContain("target_contract: Address")
  })

  it("includes the CrossContractCall node in the execution order", () => {
    const order = topologicalSort(stakePoolGraph).map((n) => n.id)
    expect(order).toEqual(["auth", "call"])
  })
})

describe("compileGraph — Storage read/write mode", () => {
  it("write mode with instance scope emits correct set call", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        {
          id: "s1",
          type: "Storage",
          data: { label: "Store", params: { storageKey: "balance", storageMode: "write", storageScope: "instance" } },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "s1" }],
    }
    const code = compileGraph(graph)
    expect(code).toContain('env.storage().instance().set(&symbol_short!("balance"), &value);')
  })

  it("write mode with persistent scope emits correct set call", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        {
          id: "s1",
          type: "Storage",
          data: { label: "Store", params: { storageKey: "balance", storageMode: "write", storageScope: "persistent" } },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "s1" }],
    }
    const code = compileGraph(graph)
    expect(code).toContain('env.storage().persistent().set(&symbol_short!("balance"), &value);')
  })

  it("write mode with temporary scope emits correct set call", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        {
          id: "s1",
          type: "Storage",
          data: { label: "Store", params: { storageKey: "balance", storageMode: "write", storageScope: "temporary" } },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "s1" }],
    }
    const code = compileGraph(graph)
    expect(code).toContain('env.storage().temporary().set(&symbol_short!("balance"), &value);')
  })

  it("read mode emits a pub fn get_ getter with i128 return type", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "auth", type: "Auth", data: { label: "Auth" } },
        {
          id: "s1",
          type: "Storage",
          data: { label: "Get Balance", params: { storageKey: "balance", storageMode: "read", storageReturnType: "i128" } },
        },
      ],
      edges: [
        { id: "e1", source: "start", target: "auth" },
        { id: "e2", source: "auth", target: "s1" },
      ],
    }
    const code = compileGraph(graph)
    expect(code).toContain("pub fn get_balance(env: Env) -> i128")
    expect(code).toContain('.get::<_, i128>(&symbol_short!("balance"))')
    expect(code).toContain(".unwrap_or(0)")
    // Should NOT emit a set call for read mode
    expect(code).not.toContain(".set(")
  })

  it("read mode with bool return type emits correct getter", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "auth", type: "Auth", data: { label: "Auth" } },
        {
          id: "s1",
          type: "Storage",
          data: { label: "Get Flag", params: { storageKey: "flag", storageMode: "read", storageReturnType: "bool" } },
        },
      ],
      edges: [
        { id: "e1", source: "start", target: "auth" },
        { id: "e2", source: "auth", target: "s1" },
      ],
    }
    const code = compileGraph(graph)
    expect(code).toContain("pub fn get_flag(env: Env) -> bool")
    expect(code).toContain('.get::<_, bool>(&symbol_short!("flag"))')
    expect(code).toContain(".unwrap_or(false)")
  })

  it("read mode with Symbol return type emits correct getter", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "auth", type: "Auth", data: { label: "Auth" } },
        {
          id: "s1",
          type: "Storage",
          data: { label: "Get Name", params: { storageKey: "name", storageMode: "read", storageReturnType: "Symbol" } },
        },
      ],
      edges: [
        { id: "e1", source: "start", target: "auth" },
        { id: "e2", source: "auth", target: "s1" },
      ],
    }
    const code = compileGraph(graph)
    expect(code).toContain("pub fn get_name(env: Env) -> Symbol")
    expect(code).toContain('.get::<_, Symbol>(&symbol_short!("name"))')
  })

  it("read mode with Address return type emits correct getter", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "auth", type: "Auth", data: { label: "Auth" } },
        {
          id: "s1",
          type: "Storage",
          data: { label: "Get Owner", params: { storageKey: "owner", storageMode: "read", storageReturnType: "Address" } },
        },
      ],
      edges: [
        { id: "e1", source: "start", target: "auth" },
        { id: "e2", source: "auth", target: "s1" },
      ],
    }
    const code = compileGraph(graph)
    expect(code).toContain("pub fn get_owner(env: Env) -> Address")
    expect(code).toContain('.get::<_, Address>(&symbol_short!("owner"))')
  })

  it("de-duplicates read-mode nodes with the same storageKey", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "auth", type: "Auth", data: { label: "Auth" } },
        {
          id: "s1",
          type: "Storage",
          data: { label: "Get Balance 1", params: { storageKey: "balance", storageMode: "read", storageReturnType: "i128" } },
        },
        {
          id: "s2",
          type: "Storage",
          data: { label: "Get Balance 2", params: { storageKey: "balance", storageMode: "read", storageReturnType: "i128" } },
        },
      ],
      edges: [
        { id: "e1", source: "start", target: "auth" },
        { id: "e2", source: "auth", target: "s1" },
        { id: "e3", source: "s1", target: "s2" },
      ],
    }
    const code = compileGraph(graph)
    // Only one getter should be emitted
    const matches = code.match(/pub fn get_balance/g)
    expect(matches).toHaveLength(1)
  })

  it("graph with both write and read Storage nodes emits both set and getter", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        {
          id: "s1",
          type: "Storage",
          data: { label: "Write", params: { storageKey: "balance", storageMode: "write", storageScope: "instance" } },
        },
        {
          id: "s2",
          type: "Storage",
          data: { label: "Read", params: { storageKey: "balance", storageMode: "read", storageReturnType: "i128" } },
        },
      ],
      edges: [
        { id: "e1", source: "start", target: "s1" },
        { id: "e2", source: "s1", target: "s2" },
      ],
    }
    const code = compileGraph(graph)
    expect(code).toContain('env.storage().instance().set(&symbol_short!("balance"), &value);')
    expect(code).toContain("pub fn get_balance(env: Env) -> i128")
  })
})

describe("compileGraph — RBACCheck block type", () => {
  it("emits correct Rust for rbacAction require", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        {
          id: "rbac1",
          type: "RBACCheck",
          data: { label: "RBAC Check", params: { rbacRole: "admin", rbacAction: "require" } },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "rbac1" }],
    }
    const code = compileGraph(graph)
    expect(code).toContain("pub fn execute(env: Env)")
    expect(code).toContain("use soroban_sdk:{Address, Env, Symbol, contract, contractimpl, panic_with_error, symbol_short};")
    expect(code).toContain('let admin: Address = env.storage().instance()')
    expect(code).toContain('.get(&symbol_short!("admin"))')
    expect(code).toContain('.unwrap_or_else(|| panic_with_error!(&env, symbol_short!("no_admin")));')
    expect(code).toContain("admin.require_auth();")
  })

  it("emits correct Rust for rbacAction grant and derives to: Address parameter", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        {
          id: "rbac1",
          type: "RBACCheck",
          data: { label: "Grant Minter", params: { rbacRole: "minter", rbacAction: "grant" } },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "rbac1" }],
    }
    const code = compileGraph(graph)
    expect(code).toContain("pub fn execute(env: Env, to: Address)")
    expect(code).toContain('env.storage().instance().set(&symbol_short!("minter"), &to);')
  })

  it("emits correct Rust for rbacAction revoke and derives to: Address parameter", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        {
          id: "rbac1",
          type: "RBACCheck",
          data: { label: "Revoke Minter", params: { rbacRole: "minter", rbacAction: "revoke" } },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "rbac1" }],
    }
    const code = compileGraph(graph)
    expect(code).toContain("pub fn execute(env: Env, to: Address)")
    expect(code).toContain('env.storage().instance().remove(&symbol_short!("minter"));')
  })

  it("emits correct Rust for transfer_admin and confirm_admin pattern", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        {
          id: "rbac_propose",
          type: "RBACCheck",
          data: { label: "Transfer Admin", params: { rbacRole: "admin", rbacAction: "transfer_admin" } },
        },
        {
          id: "rbac_confirm",
          type: "RBACCheck",
          data: { label: "Confirm Admin", params: { rbacRole: "admin", rbacAction: "confirm_admin" } },
        },
      ],
      edges: [
        { id: "e1", source: "start", target: "rbac_propose" },
        { id: "e2", source: "rbac_propose", target: "rbac_confirm" },
      ],
    }
    const code = compileGraph(graph)
    expect(code).toContain("pub fn execute(env: Env, to: Address)")
    expect(code).toContain('env.storage().instance().set(&symbol_short!("adm_pend"), &to);')
    expect(code).toContain('let pending: Address = env.storage().instance()')
    expect(code).toContain('.get(&symbol_short!("adm_pend"))')
    expect(code).toContain('pending.require_auth();')
    expect(code).toContain('env.storage().instance().set(&symbol_short!("admin"), &pending);')
    expect(code).toContain('env.storage().instance().remove(&symbol_short!("adm_pend"));')
  })

  it("emits correct Rust for custom role name", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        {
          id: "rbac1",
          type: "RBACCheck",
          data: { label: "Check Operator", params: { rbacRole: "custom", rbacCustomRole: "operator", rbacAction: "require" } },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "rbac1" }],
    }
    const code = compileGraph(graph)
    expect(code).toContain('.get(&symbol_short!("operator"))')
    expect(code).toContain('.unwrap_or_else(|| panic_with_error!(&env, symbol_short!("no_operat")));')
  })
})
