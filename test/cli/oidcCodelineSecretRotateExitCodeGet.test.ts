import { expect, test } from "bun:test"
import { oidcCodelineSecretRotateExitCodeGet } from "../../src/features/oidc/cli/oidcCodelineSecretRotateExitCodeGet.js"
import { oidcCodelineSecretRotateFailureOutputCreate } from "../../src/features/oidc/cli/oidcCodelineSecretRotateFailureOutputCreate.js"

const failureContracts = [
  ["input-invalid", 40],
  ["realm-not-found", 41],
  ["realm-ambiguous", 42],
  ["realm-inactive", 43],
  ["api-unauthorized", 44],
  ["api-unreachable", 45],
  ["api-invalid-response", 46],
  ["client-not-found", 47],
  ["client-ambiguous", 48],
  ["client-inactive", 49],
  ["client-public", 50],
  ["client-name-mismatch", 51],
  ["client-callback-mismatch", 52],
  ["client-cardinality-mismatch", 53],
  ["rotation-rejected", 54],
  ["envelope-invalid", 55],
  ["internal-failed", 56],
] as const

test("Codeline rotation preserves every closed failure exit and stderr contract", () => {
  for (const [suffix, exitCode] of failureContracts) {
    const code = `oidc.codeline-secret-rotate.${suffix}`
    expect(oidcCodelineSecretRotateExitCodeGet(code)).toBe(exitCode)
    expect(oidcCodelineSecretRotateFailureOutputCreate(code)).toBe(`${JSON.stringify({ error: { code } })}\n`)
  }

  const internalCode = "oidc.codeline-secret-rotate.internal-failed"
  expect(oidcCodelineSecretRotateExitCodeGet("private.unknown")).toBe(56)
  expect(oidcCodelineSecretRotateFailureOutputCreate("private.unknown")).toBe(
    `${JSON.stringify({ error: { code: internalCode } })}\n`,
  )
})
