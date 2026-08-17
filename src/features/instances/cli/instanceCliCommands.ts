import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { instanceApiClientCreate } from "../client/instanceApiClientCreate.js"
import type { InstanceCreateRequest } from "../public/instanceCreateRequestSchema.js"

type InstanceCliFlags = {
  readonly server?: string
  readonly token?: string
}

type InstanceCreateCliFlags = InstanceCliFlags & {
  readonly domain: string
  readonly name: string
}

type InstanceBootstrapCliFlags = InstanceCliFlags & {
  readonly instanceId: string
}

const instanceCreateCommand = buildCommand({
  async func(this: ApplicationContext, flags: InstanceCreateCliFlags) {
    const client = instanceCliClientCreate(this, flags)
    const result = await client.instanceCreate({
      domain: flags.domain,
      name: flags.name,
    } satisfies InstanceCreateRequest)
    instanceCliResultWrite(this, result)
  },
  parameters: {
    flags: {
      domain: {
        brief: "Primary instance domain",
        kind: "parsed",
        parse: (value: string) => value,
        placeholder: "DOMAIN",
      },
      name: { brief: "Instance display name", kind: "parsed", parse: (value: string) => value, placeholder: "NAME" },
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
  docs: { brief: "Create an instance" },
})

const instanceListCommand = buildCommand({
  async func(this: ApplicationContext, flags: InstanceCliFlags) {
    const result = await instanceCliClientCreate(this, flags).instanceList()
    instanceCliResultWrite(this, result)
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
  docs: { brief: "List instances" },
})

const instanceBootstrapCommand = buildCommand({
  async func(this: ApplicationContext, flags: InstanceBootstrapCliFlags) {
    const result = await instanceCliClientCreate(this, flags).instanceBootstrapAdminCreate(flags.instanceId)
    instanceCliResultWrite(this, result)
  },
  parameters: {
    flags: {
      instanceId: {
        brief: "Instance UUID",
        kind: "parsed",
        parse: (value: string) => value,
        placeholder: "INSTANCE_ID",
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

export const instanceCliCommands = buildRouteMap({
  routes: {
    bootstrapAdmin: instanceBootstrapCommand,
    create: instanceCreateCommand,
    list: instanceListCommand,
  },
  docs: { brief: "Instance administration" },
})

function instanceCliClientCreate(context: ApplicationContext, flags: InstanceCliFlags) {
  const baseUrl = flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000"
  const token = flags.token ?? context.process.env?.ZITADEL_V2_TOKEN
  return instanceApiClientCreate({ baseUrl, token })
}

function instanceCliResultWrite(
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
