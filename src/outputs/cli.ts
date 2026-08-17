#!/usr/bin/env bun

import type { ApplicationContext, Command } from "@stricli/core"
import { buildApplication, buildCommand, buildRouteMap, help, run, version } from "@stricli/core"
import { instanceCliCommands } from "../features/instances/cli/instanceCliCommands.js"
import { organizationCliCommands } from "../features/organizations/cli/organizationCliCommands.js"
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
      org: organizationCliCommands,
      organizations: organizationCliCommands,
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
