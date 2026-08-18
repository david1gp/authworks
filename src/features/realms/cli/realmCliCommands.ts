import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { realmApiClientCreate } from "../client/realmApiClientCreate.js"
import type { RealmCreateRequest } from "../public/realmCreateRequestSchema.js"

type RealmCliFlags = {
  readonly server?: string
  readonly token?: string
}

type RealmCreateCliFlags = RealmCliFlags & {
  readonly domain: string
  readonly name: string
}

type RealmBootstrapCliFlags = RealmCliFlags & {
  readonly realmId: string
}

const realmCreateCommand = buildCommand({
  async func(this: ApplicationContext, flags: RealmCreateCliFlags) {
    const client = realmCliClientCreate(this, flags)
    const result = await client.realmCreate({
      domain: flags.domain,
      name: flags.name,
    } satisfies RealmCreateRequest)
    realmCliResultWrite(this, result)
  },
  parameters: {
    flags: {
      domain: {
        brief: "Primary realm domain",
        kind: "parsed",
        parse: (value: string) => value,
        placeholder: "DOMAIN",
      },
      name: { brief: "Realm display name", kind: "parsed", parse: (value: string) => value, placeholder: "NAME" },
      server: {
        brief: "ZITADEL v2 server URL",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "URL",
      },
      token: {
        brief: "System bearer token",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "TOKEN",
      },
    },
  },
  docs: { brief: "Create a realm" },
})

const realmListCommand = buildCommand({
  async func(this: ApplicationContext, flags: RealmCliFlags) {
    const result = await realmCliClientCreate(this, flags).realmList()
    realmCliResultWrite(this, result)
  },
  parameters: {
    flags: {
      server: {
        brief: "ZITADEL v2 server URL",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "URL",
      },
      token: {
        brief: "System bearer token",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "TOKEN",
      },
    },
  },
  docs: { brief: "List realms" },
})

const realmBootstrapCommand = buildCommand({
  async func(this: ApplicationContext, flags: RealmBootstrapCliFlags) {
    const result = await realmCliClientCreate(this, flags).realmBootstrapAdminCreate(flags.realmId)
    realmCliResultWrite(this, result)
  },
  parameters: {
    flags: {
      realmId: {
        brief: "Realm UUID",
        kind: "parsed",
        parse: (value: string) => value,
        placeholder: "REALM_ID",
      },
      server: {
        brief: "ZITADEL v2 server URL",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "URL",
      },
      token: {
        brief: "System bearer token",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "TOKEN",
      },
    },
  },
  docs: { brief: "Create the one-time bootstrap administrator secret" },
})

export const realmCliCommands = buildRouteMap({
  routes: {
    bootstrapAdmin: realmBootstrapCommand,
    create: realmCreateCommand,
    list: realmListCommand,
  },
  docs: { brief: "Realm administration" },
})

function realmCliClientCreate(context: ApplicationContext, flags: RealmCliFlags) {
  const baseUrl = flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000"
  const token = flags.token ?? context.process.env?.ZITADEL_V2_TOKEN
  return realmApiClientCreate({ baseUrl, token })
}

function realmCliResultWrite(
  context: ApplicationContext,
  result: { data?: unknown; errorMessage?: string; success: boolean },
) {
  if (!result.success) {
    context.process.stderr.write(`${result.errorMessage ?? "The request failed."}\n`)
    context.process.exitCode = 1
    return
  }
  context.process.stdout.write(`${JSON.stringify(result.data)}\n`)
}
