import { Hono } from "hono"
import { instanceServerAppCreate } from "../features/instances/server/instanceServerAppCreate.js"
import { storageDatabaseOpen } from "../platform/storage/storageDatabaseOpen.js"

type ServerApplicationCreateOptions = {
  readonly databasePath: string
  readonly systemSecret?: string
}

export function serverApplicationCreate(options: ServerApplicationCreateOptions) {
  const database = storageDatabaseOpen(options.databasePath)
  if (!database.success) return new Hono()
  return instanceServerAppCreate({ database: database.data, systemSecret: options.systemSecret })
}
