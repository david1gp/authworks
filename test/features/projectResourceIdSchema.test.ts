import { expect, test } from "bun:test"
import * as v from "valibot"
import { projectResourceIdSchema } from "../../src/features/projects/public/projectResourceIdSchema.js"

test("project resource IDs accept Authworks and migrated ZITADEL identifiers", () => {
  const valid = [
    "018f0000-0000-7000-8000-000000000001",
    "323456789012345678",
    "zitadel-role-386847098022133764-assets.admin",
    "zitadel-role-386619675460501508-agent",
  ]
  const invalid = [
    "",
    "0",
    "01",
    "123456789012345678901",
    "project-1",
    "project/1",
    "018f0000-0000-4000-8000-000000000001",
    "018F0000-0000-7000-8000-000000000001",
    "zitadel-role-",
    "zitadel-role-0123-admin",
    "zitadel-role-123-",
  ]

  for (const id of valid) expect(v.safeParse(projectResourceIdSchema, id).success).toBe(true)
  for (const id of invalid) expect(v.safeParse(projectResourceIdSchema, id).success).toBe(false)
})
