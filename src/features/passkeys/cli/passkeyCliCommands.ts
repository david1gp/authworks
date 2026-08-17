import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { passkeyApiClientCreate } from "../client/passkeyApiClientCreate.js"

type PasskeyCliFlags = { readonly server?: string; readonly token?: string; readonly instanceId: string }

const passkeyListCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags) {
    passkeyResultWrite(this, await passkeyClientCreate(this, flags).passkeyCredentialList(flags.instanceId))
  },
  parameters: { flags: { ...passkeyCommonFlags(), instanceId: passkeyInstanceIdFlag() } },
  docs: { brief: "List passkey credentials" },
})

const passkeyRevokeCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & { credentialId: string }) {
    passkeyResultWrite(
      this,
      await passkeyClientCreate(this, flags).passkeyCredentialRevoke(flags.instanceId, {
        credentialId: flags.credentialId,
      }),
    )
  },
  parameters: {
    flags: {
      ...passkeyCommonFlags(),
      instanceId: passkeyInstanceIdFlag(),
      credentialId: passkeyTextFlag("Credential ID"),
    },
  },
  docs: { brief: "Revoke a passkey credential" },
})

export const passkeyCliCommands = buildRouteMap({
  routes: { list: passkeyListCommand, revoke: passkeyRevokeCommand },
  docs: { brief: "Manage passkey credentials" },
})

function passkeyClientCreate(context: ApplicationContext, flags: PasskeyCliFlags) {
  return passkeyApiClientCreate({
    baseUrl: flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000",
    token: flags.token ?? context.process.env?.ZITADEL_V2_TOKEN,
  })
}

function passkeyResultWrite(
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

function passkeyCommonFlags() {
  return {
    server: {
      brief: "ZITADEL v2 server URL",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "URL",
    },
    token: {
      brief: "Bearer token",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
  }
}

function passkeyInstanceIdFlag() {
  return {
    brief: "Instance UUID",
    kind: "parsed" as const,
    parse: (value: string) => value,
    placeholder: "INSTANCE_ID",
  }
}

function passkeyTextFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}
