import { expect, test } from "bun:test"
import { packageName } from "../src/outputs/library.js"

test("packageName is the published scope", () => {
  expect(packageName).toBe("@adaptive-ds/authworks")
})
