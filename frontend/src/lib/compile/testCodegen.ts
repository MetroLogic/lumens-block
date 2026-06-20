import {
  generateContractSource,
  getExecutionOrder,
  getFunctionParamsFromGraph,
  paramRustTypeToInputType,
} from "./codegen"
import type { ContractGraph } from "./schema"
import type { ContractTestCase, ContractTestInput } from "./test-schema"

function sanitizeTestFnName(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_]/g, "_")
  return cleaned.length > 0 ? cleaned : "case"
}

function sanitizeSymbol(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 9)
  return cleaned.length > 0 ? cleaned : "val"
}

function escapeRustString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function emitInputBinding(input: ContractTestInput, fallbackExpr: string): string {
  const raw = input.value.trim()

  switch (input.type) {
    case "number": {
      const parsed = raw.length > 0 ? raw : "0"
      if (!/^-?\d+$/.test(parsed)) {
        throw new Error(`Test input "${input.name}" must be a valid integer.`)
      }
      return `${parsed}i128`
    }
    case "boolean": {
      const normalized = raw.toLowerCase()
      if (normalized === "false" || normalized === "0") return "false"
      return "true"
    }
    case "symbol": {
      const symbol = sanitizeSymbol(raw.length > 0 ? raw : input.name)
      return `symbol_short!("${symbol}")`
    }
    case "address":
    default: {
      if (raw.length > 0) {
        return `Address::from_string(&env, &String::from_str(&env, "${escapeRustString(raw)}"))`
      }
      return fallbackExpr
    }
  }
}

function emitTestCase(
  testCase: ContractTestCase,
  params: ReturnType<typeof getFunctionParamsFromGraph>,
  needsAuth: boolean,
  needsTransfer: boolean
): string {
  const fnName = `lumens_test_${sanitizeTestFnName(testCase.id)}`
  const shouldPanic = !testCase.expected.success
  const panicAttr = shouldPanic ? "\n    #[should_panic]" : ""
  const executableParams = params.filter((param) => param.name !== "env")

  const setup: string[] = ["        let env = Env::default();"]
  if (needsAuth) {
    setup.push("        env.mock_all_auths();")
  }
  if (needsTransfer) {
    setup.push("        let token_admin = Address::generate(&env);")
    setup.push("        let token = env.register_stellar_asset_contract(token_admin.clone());")
    setup.push("        let asset_client = token::StellarAssetClient::new(&env, &token);")
    setup.push("        asset_client.mint(&token_admin, &1_000_000i128);")
  }

  const bindings: string[] = []
  const invokeArgs: string[] = []

  for (const param of executableParams) {
    const input =
      testCase.inputs.find((candidate) => candidate.name === param.name) ??
      ({
        name: param.name,
        type: paramRustTypeToInputType(param.rustType),
        value: "",
      } satisfies ContractTestInput)

    let fallback = "Address::generate(&env)"
    if (param.name === "token" && needsTransfer) {
      fallback = "token.clone()"
    } else if (param.name === "from" && needsTransfer) {
      fallback = "token_admin.clone()"
    }

    const bindingName = param.name
    const expr = emitInputBinding(input, fallback)
    bindings.push(`        let ${bindingName} = ${expr};`)
    invokeArgs.push(`&${bindingName}`)
  }

  return `${panicAttr}
    #[test]
    fn ${fnName}() {
${setup.join("\n")}
${bindings.join("\n")}
        let contract_id = env.register_contract(None, LumensBlockGenerated);
        let client = LumensBlockGeneratedClient::new(&env, &contract_id);
        client.execute(${invokeArgs.join(", ")});
    }`
}

/**
 * Generates Soroban unit tests appended to the contract source file.
 */
export function generateContractTests(graph: ContractGraph, testCases: ContractTestCase[]): string {
  const { source } = generateContractSource(graph)
  const params = getFunctionParamsFromGraph(graph)
  const executionOrder = getExecutionOrder(graph)
  const blockTypes = new Set(executionOrder.map((node) => node.type))
  const needsAuth = blockTypes.has("Auth")
  const needsTransfer = blockTypes.has("Transfer")

  const tests = testCases.map((testCase) =>
    emitTestCase(testCase, params, needsAuth, needsTransfer)
  )

  const testModule = `
#[cfg(test)]
mod contract_tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, token, Address, Env, String, symbol_short};

${tests.join("\n\n")}
}
`

  return `${source}${testModule}`
}
