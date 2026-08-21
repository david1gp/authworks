import { type Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"
import { type StorageCurrentState, storageCurrentStateTable } from "./storageCurrentStateTable.js"
import { storageJsonEncode } from "./storageJsonEncode.js"
import type { StorageExecutor } from "./storageSchema.js"

export type StorageCurrentStateInput = {
  key: string
  updatedAt: number
  value: unknown
  version: number
}

export function storageCurrentStateSet(
  database: StorageExecutor,
  input: StorageCurrentStateInput,
): Result<StorageCurrentState> {
  const op = "storageCurrentStateSet"
  if (input.key.length === 0) return resultErrorCreate(op, "The current-state key is required.")
  if (!Number.isSafeInteger(input.version) || input.version < 1)
    return resultErrorCreate(op, "The current-state version must be a positive integer.")
  if (!Number.isSafeInteger(input.updatedAt) || input.updatedAt < 0)
    return resultErrorCreate(op, "The current-state timestamp must be a non-negative integer.")

  const value = storageJsonEncode(input.value)
  if (!value.success) return value

  try {
    const state = database
      .insert(storageCurrentStateTable)
      .values({ key: input.key, updatedAt: input.updatedAt, value: value.data, version: input.version })
      .onConflictDoUpdate({
        set: { updatedAt: input.updatedAt, value: value.data, version: input.version },
        target: storageCurrentStateTable.key,
      })
      .returning()
      .get()
    if (state === undefined) return resultErrorCreate(op, "The current state could not be written.")
    return resultCreate(state)
  } catch (_error) {
    return resultErrorCreate(op, "The current state could not be written.")
  }
}
