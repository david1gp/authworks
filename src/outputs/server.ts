import { serverApplicationCreate } from "../compositions/serverApplicationCreate.js"
import { mailTransportConfigurationParse } from "../features/email/server/mailTransportConfigurationParse.js"
import { smtpMailDeliveryPortCreate } from "../features/email/server/smtpMailDeliveryPortCreate.js"
import { configurationParse } from "../platform/configuration/configurationParse.js"

export function serverListen(): void {
  const parsed = configurationParse({
    databasePath: process.env.AUTHWORKS_DATABASE_PATH ?? process.env.DATABASE_PATH,
    host: process.env.AUTHWORKS_HOST ?? process.env.HOST,
    nodeEnv: Bun.env.NODE_ENV,
    port: process.env.AUTHWORKS_PORT ?? process.env.PORT,
    publicOrigin: process.env.AUTHWORKS_PUBLIC_ORIGIN ?? process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3000",
  })
  if (!parsed.success) {
    console.error(parsed.errorMessage)
    process.exit(1)
  }

  const mailConfiguration = mailTransportConfigurationParse(process.env, parsed.data.publicOrigin)
  if (!mailConfiguration.success) {
    console.error(mailConfiguration.errorMessage)
    process.exit(1)
  }

  const created = serverApplicationCreate({
    browserMode: true,
    databasePath: parsed.data.databasePath,
    emailGenerator: mailConfiguration.data?.emailGenerator,
    mailDelivery:
      mailConfiguration.data === undefined ? undefined : smtpMailDeliveryPortCreate(mailConfiguration.data.smtp),
    production: parsed.data.nodeEnv === "production",
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
