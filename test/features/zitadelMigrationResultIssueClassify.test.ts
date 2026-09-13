import { expect, test } from "bun:test"
import { zitadelMigrationResultIssueClassify } from "../../src/features/zitadelMigration/public/zitadelMigrationResultIssueClassify.js"

const cases = [
  [{ code: "invalid_config" }, "source-config-invalid"],
  [{ code: "permission_denied" }, "source-permission-denied"],
  [{ code: "unauthenticated" }, "source-unauthenticated"],
  [{ code: "unavailable" }, "source-unavailable"],
  [{ code: "invalid_argument" }, "source-malformed-request"],
  [{ status: 403, errorMessage: "secret=do-not-output" }, "source-permission-denied"],
] as const

test.each(cases)("classifies failed SDK result", (result, code) => {
  const issue = zitadelMigrationResultIssueClassify("users", result)
  expect(issue.code).toBe(code)
  expect(issue.reason).not.toContain("do-not-output")
  expect(JSON.stringify(issue)).not.toContain("secret")
})
