import { expect, test } from "bun:test"
import * as v from "valibot"
import { wahaHealthCandidateStatusSchema } from "../../src/features/waha/domain/wahaHealthCandidateStatusSchema.js"

test("WAHA health candidate status accepts only persisted health states", () => {
  expect(v.safeParse(wahaHealthCandidateStatusSchema, "unknown")).toMatchObject({ success: true, output: "unknown" })
  expect(v.safeParse(wahaHealthCandidateStatusSchema, "healthy")).toMatchObject({ success: true, output: "healthy" })
  expect(v.safeParse(wahaHealthCandidateStatusSchema, "unhealthy")).toMatchObject({
    success: true,
    output: "unhealthy",
  })
  expect(v.safeParse(wahaHealthCandidateStatusSchema, "WORKING").success).toBe(false)
})
