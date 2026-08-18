import { configurationParse } from "../platform/configuration/configurationParse.js"
import { serverApplicationCreate } from "../compositions/serverApplicationCreate.js"

export function serverListen(): void {
  const parsed = configurationParse({
    databasePath: process.env.AUTHWORKS_DATABASE_PATH ?? process.env.DATABASE_PATH,
    host: process.env.AUTHWORKS_HOST ?? process.env.HOST,
    nodeEnv: process.env.NODE_ENV,
    port: process.env.AUTHWORKS_PORT ?? process.env.PORT,
    publicOrigin: process.env.AUTHWORKS_PUBLIC_ORIGIN ?? process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3000",
  })
  if (!parsed.success) {
    console.error(parsed.errorMessage)
    process.exit(1)
  }

  const created = serverApplicationCreate({
    databasePath: parsed.data.databasePath,
    publicOrigin: parsed.data.publicOrigin,
    systemSecret: process.env.AUTHWORKS_SYSTEM_SECRET,
  })
  if (!created.success) {
    console.error(created.errorMessage)
    process.exit(1)
  }

  Bun.serve({
    fetch: created.data.fetch,
    hostname: parsed.data.host,
    port: parsed.data.port,
  })
}

if (import.meta.main) serverListen()
