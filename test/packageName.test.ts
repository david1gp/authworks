import { expect, test } from "bun:test"
import { packageName } from "../src/outputs/library.ts"

test("packageName is the published scope", () => {
  expect(packageName).toBe("@adaptive-ds/zitadel-v2")
})
