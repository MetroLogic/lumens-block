import { NextRequest, NextResponse } from "next/server"

import { runContractTests } from "@/lib/compile/testRunner"
import { MAX_TEST_CASES, type ContractTestCase } from "@/lib/compile/test-schema"
import { validateContractGraph } from "@/lib/compile/validate"

export const runtime = "nodejs"
export const maxDuration = 120

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validateTestCases(raw: unknown): { ok: true; testCases: ContractTestCase[] } | { ok: false; message: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, message: "testCases must be an array." }
  }

  if (raw.length === 0) {
    return { ok: false, message: "At least one test case is required." }
  }

  if (raw.length > MAX_TEST_CASES) {
    return { ok: false, message: `Maximum of ${MAX_TEST_CASES} test cases allowed.` }
  }

  const testCases: ContractTestCase[] = []

  for (let index = 0; index < raw.length; index++) {
    const item = raw[index]
    if (!isPlainObject(item)) {
      return { ok: false, message: `Test case at index ${index} must be an object.` }
    }

    if (typeof item.id !== "string" || item.id.trim() === "") {
      return { ok: false, message: `Test case at index ${index} must have a non-empty id.` }
    }

    if (typeof item.name !== "string" || item.name.trim() === "") {
      return { ok: false, message: `Test case "${item.id}" must have a non-empty name.` }
    }

    if (!isPlainObject(item.expected) || typeof item.expected.success !== "boolean") {
      return { ok: false, message: `Test case "${item.id}" must include expected.success as a boolean.` }
    }

    if (!Array.isArray(item.inputs)) {
      return { ok: false, message: `Test case "${item.id}" must include an inputs array.` }
    }

    const inputs = item.inputs.map((input, inputIndex) => {
      if (!isPlainObject(input)) {
        throw new Error(`Input at index ${inputIndex} in test case "${item.id}" must be an object.`)
      }
      if (typeof input.name !== "string" || input.name.trim() === "") {
        throw new Error(`Input at index ${inputIndex} in test case "${item.id}" must have a name.`)
      }
      if (typeof input.type !== "string") {
        throw new Error(`Input "${input.name}" in test case "${item.id}" must have a type.`)
      }
      if (typeof input.value !== "string") {
        throw new Error(`Input "${input.name}" in test case "${item.id}" must have a string value.`)
      }
      return {
        name: input.name,
        type: input.type,
        value: input.value,
      } as ContractTestCase["inputs"][number]
    })

    testCases.push({
      id: item.id,
      name: item.name,
      inputs,
      expected: {
        success: item.expected.success,
        ...(typeof item.expected.output === "string" ? { output: item.expected.output } : {}),
      },
    })
  }

  return { ok: true, testCases }
}

export async function POST(request: NextRequest) {
  let rawBody: unknown
  let byteLength = 0

  try {
    const text = await request.text()
    byteLength = Buffer.byteLength(text, "utf8")

    if (text.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PAYLOAD",
            message: "Request body must include graph and testCases.",
          },
        },
        { status: 400 }
      )
    }

    rawBody = JSON.parse(text)
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "MALFORMED_JSON",
          message: "Request body is not valid JSON.",
        },
      },
      { status: 400 }
    )
  }

  if (!isPlainObject(rawBody)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PAYLOAD",
          message: "Request body must be a JSON object.",
        },
      },
      { status: 400 }
    )
  }

  const graphPayload = isPlainObject(rawBody.graph) ? rawBody.graph : rawBody
  const validation = validateContractGraph(graphPayload, byteLength)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  let testCasesValidation: ReturnType<typeof validateTestCases>
  try {
    testCasesValidation = validateTestCases(rawBody.testCases)
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_TEST_CASES",
          message: err instanceof Error ? err.message : "Invalid test cases.",
        },
      },
      { status: 400 }
    )
  }

  if (!testCasesValidation.ok) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_TEST_CASES",
          message: testCasesValidation.message,
        },
      },
      { status: 400 }
    )
  }

  const result = await runContractTests(validation.graph, testCasesValidation.testCases)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json(result.data)
}
