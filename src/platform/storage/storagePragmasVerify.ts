import { Database } from "bun:sqlite"
import { type Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"

type StoragePragmas = {
  busyTimeout: number
  foreignKeys: number
  journalMode: string
  recursiveTriggers: number
  synchronous: number
  tempStore: number
}

export function storagePragmasVerify(sqlite: Database): Result<StoragePragmas> {
  const op = "storagePragmasVerify"

  try {
    sqlite.run("PRAGMA journal_mode = WAL")
    sqlite.run("PRAGMA synchronous = FULL")
    sqlite.run("PRAGMA foreign_keys = ON")
    sqlite.run("PRAGMA temp_store = MEMORY")
    sqlite.run("PRAGMA busy_timeout = 5000")
    sqlite.run("PRAGMA recursive_triggers = ON")

    const pragmas: StoragePragmas = {
      busyTimeout: storagePragmaNumberGet(sqlite, "PRAGMA busy_timeout", "timeout"),
      foreignKeys: storagePragmaNumberGet(sqlite, "PRAGMA foreign_keys", "foreign_keys"),
      journalMode: storagePragmaStringGet(sqlite, "PRAGMA journal_mode", "journal_mode"),
      recursiveTriggers: storagePragmaNumberGet(sqlite, "PRAGMA recursive_triggers", "recursive_triggers"),
      synchronous: storagePragmaNumberGet(sqlite, "PRAGMA synchronous", "synchronous"),
      tempStore: storagePragmaNumberGet(sqlite, "PRAGMA temp_store", "temp_store"),
    }

    if (
      pragmas.busyTimeout !== 5000 ||
      pragmas.foreignKeys !== 1 ||
      pragmas.journalMode !== "wal" ||
      pragmas.recursiveTriggers !== 1 ||
      pragmas.synchronous !== 2 ||
      pragmas.tempStore !== 2
    ) {
      return resultErrorCreate(op, "SQLite durability pragmas could not be verified.")
    }

    return resultCreate(pragmas)
  } catch (_error) {
    return resultErrorCreate(op, "SQLite durability pragmas could not be verified.")
  }
}

function storagePragmaNumberGet(sqlite: Database, statement: string, key: string): number {
  const row = sqlite.query<Record<string, unknown>, []>(statement).get()
  const value = row?.[key]
  if (value !== 1 && value !== 2 && value !== 5000) throw new Error("Unexpected SQLite pragma value.")
  return value
}

function storagePragmaStringGet(sqlite: Database, statement: string, key: string): string {
  const row = sqlite.query<Record<string, unknown>, []>(statement).get()
  const value = row?.[key]
  if (typeof value !== "string" || value.toLowerCase() !== "wal") throw new Error("Unexpected SQLite pragma value.")
  return "wal"
}
