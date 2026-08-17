import { type Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"

export function storageJsonEncode(value: unknown): Result<unknown> {
  const op = "storageJsonEncode"
  if (!storageJsonValueIsValid(value)) return resultErrorCreate(op, "Storage values must be valid JSON.")

  try {
    const encoded = JSON.stringify(value)
    if (encoded === undefined) return resultErrorCreate(op, "Storage values must be valid JSON.")
    return resultCreate(JSON.parse(encoded))
  } catch (_error) {
    return resultErrorCreate(op, "Storage values must be valid JSON.")
  }
}

function storageJsonValueIsValid(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(storageJsonValueIsValid)
  if (typeof value !== "object") return false

  const prototype = Object.getPrototypeOf(value)
  return (prototype === Object.prototype || prototype === null) && Object.values(value).every(storageJsonValueIsValid)
}
