import { type Result, type ResultErr } from "#result"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"
import type { StorageDatabase } from "./storageDatabaseOpen.js"
import type { StorageTransaction } from "./storageSchema.js"

class StorageTransactionRollback extends Error {
  readonly result: ResultErr

  constructor(result: ResultErr) {
    super(result.errorMessage)
    this.result = result
  }
}

export function storageTransactionRun<T>(
  database: StorageDatabase,
  operation: (transaction: StorageTransaction) => Result<T>,
): Result<T> {
  const op = "storageTransactionRun"

  try {
    return database.db.transaction((transaction) => {
      const result = operation(transaction)
      if (!result.success) throw new StorageTransactionRollback(result)
      return result
    })
  } catch (error: unknown) {
    if (error instanceof StorageTransactionRollback) return error.result
    return resultErrorCreate(op, "The SQLite transaction failed.")
  }
}
