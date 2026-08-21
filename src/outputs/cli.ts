#!/usr/bin/env bun

import { buildApplication, buildCommand, buildRouteMap, help, run, version } from "@stricli/core"
import { emailOtpCliCommands } from "../features/emailOtp/cli/emailOtpCliCommands.js"
import { externalIdentityCliCommands } from "../features/externalIdentities/cli/externalIdentityCliCommands.js"
import { impersonationCliCommands } from "../features/impersonation/cli/impersonationCliCommands.js"
import { machineUserCliCommands } from "../features/machineUsers/cli/machineUserCliCommands.js"
import { mfaCliCommands } from "../features/mfa/cli/mfaCliCommands.js"
import { oidcCliCommands } from "../features/oidc/cli/oidcCliCommands.js"
import { organizationCliCommands } from "../features/organizations/cli/organizationCliCommands.js"
import { passkeyCliCommands } from "../features/passkeys/cli/passkeyCliCommands.js"
import { passwordCliCommands } from "../features/passwords/cli/passwordCliCommands.js"
import { projectCliCommands } from "../features/projects/cli/projectCliCommands.js"
import { realmCliCommands } from "../features/realms/cli/realmCliCommands.js"
import { sessionCliCommands } from "../features/sessions/cli/sessionCliCommands.js"
import { userCliCommands } from "../features/users/cli/userCliCommands.js"
import { packageVersion } from "../packageVersion.js"

const cliApplication = buildApplication(
  buildRouteMap({
    routes: {
      realms: realmCliCommands,
      emailOtp: emailOtpCliCommands,
      externalIdentities: externalIdentityCliCommands,
      externalIdentity: externalIdentityCliCommands,
      emailOtps: emailOtpCliCommands,
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
    },
    docs: {
      brief: "Authworks identity platform",
    },
  }),
  {
    name: "authworks",
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
        currentVersion: packageVersion,
      },
    }),
  },
)

if (import.meta.main) {
  await run(cliApplication, process.argv.slice(2), { process })
}
