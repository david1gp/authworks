import { expect, test } from "bun:test"
import { connectionProfileCliOutputRedact } from "../../src/features/connectionProfiles/cli/connectionProfileCliOutputRedact.js"

test("redacts raw and JSON-escaped representations of multiple secrets", () => {
  const firstSecret = 'quote" slash\\ newline\n control\u0001'
  const secondSecret = "second-secret"
  const secrets = [firstSecret, secondSecret, undefined, "", "[REDACTED]", "REDACTED"]

  expect(
    connectionProfileCliOutputRedact(`visible raw ${firstSecret}; visible second ${secondSecret}; [REDACTED]`, secrets),
  ).toBe("visible raw [REDACTED]; visible second [REDACTED]; [REDACTED]")

  const jsonOutput = JSON.stringify({ first: firstSecret, second: secondSecret, visible: "not-secret" })
  expect(connectionProfileCliOutputRedact(jsonOutput, secrets)).toBe(
    JSON.stringify({ first: "[REDACTED]", second: "[REDACTED]", visible: "not-secret" }),
  )
})

test("redacts overlapping secrets without modifying the replacement marker", () => {
  expect(connectionProfileCliOutputRedact("prefix-long-secret-suffix [REDACTED]", ["secret", "long-secret"])).toBe(
    "prefix-[REDACTED]-suffix [REDACTED]",
  )
})
