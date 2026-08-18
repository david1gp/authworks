import { expect, test } from "bun:test"
import * as v from "valibot"
import { patchClearableSchemaCreate } from "../../src/platform/http/patchClearableSchemaCreate.js"
import { patchEmptyCode } from "../../src/platform/http/patchEmptyCode.js"
import { patchInputParse } from "../../src/platform/http/patchInputParse.js"
import { patchKeysPresent } from "../../src/platform/http/patchKeysPresent.js"

const patchSchema = v.object({
  displayName: patchClearableSchemaCreate(v.string()),
})

test("optional PATCH fields are omitted from parsed output when omitted", () => {
  const parsed = v.safeParse(patchSchema, {})

  expect(parsed.success).toBe(true)
  if (!parsed.success) return
  expect(parsed.output).toEqual({})
  expect("displayName" in parsed.output).toBe(false)
})

test("null is a present clear value and is not an empty PATCH", () => {
  const input = { displayName: null }

  expect(patchKeysPresent(input)).toEqual(["displayName"])
  expect(patchInputParse("userUpdate", patchSchema, input)).toEqual({ data: input, success: true })
})

test("an empty PATCH fails with the stable empty-patch contract", () => {
  const result = patchInputParse("userUpdate", patchSchema, {})

  expect(result).toEqual({
    code: "platform.empty-patch",
    errorMessage: "The patch is empty.",
    op: "userUpdate",
    success: false,
  })
  expect(patchEmptyCode).toBe("platform.empty-patch")
})

test("an invalid PATCH fails", () => {
  const result = patchInputParse("userUpdate", patchSchema, { displayName: 42 })

  expect(result).toEqual({
    code: "platform.invalid",
    errorMessage: "The patch is invalid.",
    op: "userUpdate",
    success: false,
  })
})
