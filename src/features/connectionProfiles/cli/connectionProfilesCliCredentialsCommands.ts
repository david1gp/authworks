import { type ApplicationContext, buildChoiceParser, buildCommand, buildRouteMap } from "@stricli/core"
import { authworksLocalCredentialLookup } from "../public/index.js"
import { connectionProfileCliProfileFlag } from "./connectionProfileCliProfileFlag.js"

type CredentialsGetFlags = {
  readonly envFile?: string
  readonly field?: string
  readonly output?: string
  readonly profile?: string
  readonly project?: string
}

const credentialsGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: CredentialsGetFlags, alias: string) {
    if (flags.field === undefined && flags.output !== "json") {
      credentialsCliErrorWrite(this, "Expected --field or --output json.")
      return
    }
    if (flags.field !== undefined && flags.output !== undefined) {
      credentialsCliErrorWrite(this, "Use --field or --output json, not both.")
      return
    }

    const result = await authworksLocalCredentialLookup({
      alias,
      envFile: flags.envFile,
      profile: flags.profile,
      project: flags.project,
    })
    if (!result.success) {
      credentialsCliErrorWrite(this, result.errorMessage ?? "The credential could not be read.")
      return
    }
    if (result.data === undefined) {
      credentialsCliErrorWrite(this, `Credential alias "${alias}" was not found.`)
      return
    }

    if (flags.output === "json") {
      this.process.stdout.write(
        `${JSON.stringify({ userId: result.data.userId, username: result.data.username, password: result.data.password })}\n`,
      )
      return
    }
    if (flags.field === "username" || flags.field === "password" || flags.field === "userId") {
      this.process.stdout.write(`${result.data[flags.field]}\n`)
      return
    }
    credentialsCliErrorWrite(this, "The credential field must be username, password, or userId.")
  },
  parameters: {
    flags: {
      envFile: credentialsTextFlag("Dotenv environment file", "PATH"),
      field: {
        ...credentialsTextFlag("Credential field", "username|password|userId"),
        optional: true as const,
        parse: buildChoiceParser(["username", "password", "userId"] as const),
      },
      output: {
        brief: "Credential output format",
        kind: "parsed" as const,
        optional: true as const,
        parse: buildChoiceParser(["json"] as const),
        placeholder: "json",
      },
      profile: connectionProfileCliProfileFlag(),
      project: credentialsTextFlag("Central Authworks project name", "NAME"),
    },
    positional: { kind: "tuple", parameters: [credentialsAliasParameter()] },
  },
  docs: { brief: "Read a local test-user credential" },
})

export const connectionProfilesCliCredentialsCommands = buildRouteMap({
  routes: { get: credentialsGetCommand },
  docs: { brief: "Read local credentials" },
})

function credentialsAliasParameter() {
  return {
    brief: "Test-user credential alias",
    parse: (value: string) => value,
    placeholder: "ALIAS",
  }
}

function credentialsTextFlag(brief: string, placeholder: string) {
  return {
    brief,
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder,
  }
}

function credentialsCliErrorWrite(context: ApplicationContext, message: string) {
  context.process.stderr.write(`${message}\n`)
  context.process.exitCode = 1
}
