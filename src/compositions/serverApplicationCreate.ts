import { Hono } from "hono"
import { instanceServerAppCreate } from "../features/instances/server/instanceServerAppCreate.js"
import { organizationServerAppCreate } from "../features/organizations/server/organizationServerAppCreate.js"
import { userServerAppCreate } from "../features/users/server/userServerAppCreate.js"
import { storageDatabaseOpen } from "../platform/storage/storageDatabaseOpen.js"

type ServerApplicationCreateOptions = {
  readonly databasePath: string
  readonly systemSecret?: string
}

export function serverApplicationCreate(options: ServerApplicationCreateOptions) {
  const database = storageDatabaseOpen(options.databasePath)
  if (!database.success) return new Hono()
  const application = instanceServerAppCreate({ database: database.data, systemSecret: options.systemSecret })
  application.route("/", organizationServerAppCreate({ database: database.data, systemSecret: options.systemSecret }))
  application.route("/", userServerAppCreate({ database: database.data, systemSecret: options.systemSecret }))
  return application
}
