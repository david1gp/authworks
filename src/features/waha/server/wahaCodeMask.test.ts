import { expect, test } from "bun:test"
import { wahaCodeMask } from "./wahaCodeMask.js"

test("wahaCodeMask redacts codes to first plus last character", () => {
  expect(wahaCodeMask("123456")).toBe("1***6")
  expect(wahaCodeMask("123")).toBe("1***3")
})

test("wahaCodeMask collapses short codes fully", () => {
  expect(wahaCodeMask("12")).toBe("***")
  expect(wahaCodeMask("1")).toBe("***")
  expect(wahaCodeMask("")).toBe("***")
})
