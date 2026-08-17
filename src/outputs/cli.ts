#!/usr/bin/env bun

import type { ApplicationContext, Command } from "@stricli/core"
import { buildApplication, buildCommand, buildRouteMap, help, run, version } from "@stricli/core"
import { emailOtpCliCommands } from "../features/emailOtp/cli/emailOtpCliCommands.js"
import { externalIdentityCliCommands } from "../features/externalIdentities/cli/externalIdentityCliCommands.js"
import { instanceCliCommands } from "../features/instances/cli/instanceCliCommands.js"
import { organizationCliCommands } from "../features/organizations/cli/organizationCliCommands.js"
import { oidcCliCommands } from "../features/oidc/cli/oidcCliCommands.js"
import { mfaCliCommands } from "../features/mfa/cli/mfaCliCommands.js"
import { impersonationCliCommands } from "../features/impersonation/cli/impersonationCliCommands.js"
import { machineUserCliCommands } from "../features/machineUsers/cli/machineUserCliCommands.js"
import { passkeyCliCommands } from "../features/passkeys/cli/passkeyCliCommands.js"
import { passwordCliCommands } from "../features/passwords/cli/passwordCliCommands.js"
import { projectCliCommands } from "../features/projects/cli/projectCliCommands.js"
import { sessionCliCommands } from "../features/sessions/cli/sessionCliCommands.js"
import { userCliCommands } from "../features/users/cli/userCliCommands.js"

const scaffoldCommand: Command<ApplicationContext> = buildCommand<Record<never, never>, [], ApplicationContext>({
  func: function (this: ApplicationContext) {
    this.process.stdout.write("ZITADEL v2 scaffold\n")
  },
  parameters: {
    flags: {},
  },
  docs: {
    brief: "Print scaffold status",
  },
})

const cliApplication = buildApplication(
  buildRouteMap({
    routes: {
      instances: instanceCliCommands,
      emailOtp: emailOtpCliCommands,
      externalIdentities: externalIdentityCliCommands,
      externalIdentity: externalIdentityCliCommands,
      org: organizationCliCommands,
      organizations: organizationCliCommands,
      oidc: oidcCliCommands,
      oidcClients: oidcCliCommands,
      mfa: mfaCliCommands,
      mfaPolicy: mfaCliCommands,
      impersonation: impersonationCliCommands,
      impersonate: impersonationCliCommands,
      machine: machineUserCliCommands,
      machineUsers: machineUserCliCommands,
      passkey: passkeyCliCommands,
      passkeys: passkeyCliCommands,
      password: passwordCliCommands,
      passwords: passwordCliCommands,
      project: projectCliCommands,
      projects: projectCliCommands,
      session: sessionCliCommands,
      sessions: sessionCliCommands,
      user: userCliCommands,
      users: userCliCommands,
      status: scaffoldCommand,
    },
    docs: {
      brief: "ZITADEL v2 identity platform",
    },
  }),
  {
    name: "zitadel-v2",
    scanner: {
      caseStyle: "allow-kebab-for-camel",
    },
  },
  {
    help: help({
      brief: "Print help information and exit",
      formatting: {
        caseStyle: "convert-camel-to-kebab",
        onlyRequiredInUsageLine: false,
        useAliasInUsageLine: false,
      },
    }),
    version: version({
      brief: "Print version information and exit",
      info: {
        currentVersion: "0.1.0",
      },
    }),
  },
)

if (import.meta.main) {
  await run(cliApplication, process.argv.slice(2), { process })
}
