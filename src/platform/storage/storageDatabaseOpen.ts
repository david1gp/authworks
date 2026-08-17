import { Database } from "bun:sqlite"
import { type Result } from "#result"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"
import { runtimeCreate } from "../runtime/runtimeCreate.js"
import { storagePragmasVerify } from "./storagePragmasVerify.js"
import { storageSchema, type StorageClient } from "./storageSchema.js"
import { storageSchemaCreate } from "./storageSchemaCreate.js"

export type StorageDatabase = {
  db: StorageClient
  runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  sqlite: Database
  close: () => void
}

export function storageDatabaseOpen(
  databasePath: string,
  runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes"> = runtimeCreate(),
): Result<StorageDatabase> {
  const op = "storageDatabaseOpen"
  if (databasePath.length === 0 || databasePath === ":memory:") {
    return resultErrorCreate(op, "A file-backed SQLite database path is required.")
  }

  let sqlite: Database | undefined
  try {
    sqlite = new Database(databasePath)
    const pragmas = storagePragmasVerify(sqlite)
    if (!pragmas.success) {
      sqlite.close()
      return pragmas
    }

    const db = drizzle(sqlite, { schema: storageSchema })
    const schema = storageSchemaCreate(db)
    if (!schema.success) {
      sqlite.close()
      return schema
    }

    return resultCreate({
      close: () => sqlite?.close(),
      db,
      runtime,
      sqlite,
    })
  } catch (_error) {
    sqlite?.close()
    return resultErrorCreate(op, "The SQLite database could not be opened.")
  }
}
