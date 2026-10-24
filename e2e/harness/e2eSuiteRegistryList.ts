import { existsSync } from "node:fs"
import { join } from "node:path"
import type { E2eTarget } from "./e2eTargetSchema.js"

export type E2eSuiteKind = "local" | "live"

export type E2eSuite = {
  readonly files: readonly string[]
  readonly kind: E2eSuiteKind
  readonly name: string
  readonly targets: readonly E2eTarget[]
}

type E2eSuiteRegistryListOptions = {
  readonly workflowExists?: (workflowName: string) => boolean
}

const localSuites: readonly E2eSuite[] = [
  {
    files: ["e2e/loginDemo.spec.ts", "e2e/loginParity.spec.ts", "e2e/loginProduction.spec.ts"],
    kind: "local",
    name: "login",
    targets: ["production", "dev"],
  },
  {
    files: ["e2e/accountDemo.spec.ts", "e2e/accountProfilePages.spec.ts", "e2e/accountAccessProduction.spec.ts"],
    kind: "local",
    name: "account",
    targets: ["production", "dev"],
  },
  {
    files: [
      "e2e/machineAdminDemo.spec.ts",
      "e2e/machineAdminProduction.spec.ts",
      "e2e/oidcAdminDemo.spec.ts",
      "e2e/oidcAdminProduction.spec.ts",
      "e2e/impersonationAdmin.spec.ts",
      "e2e/productionShells.spec.ts",
    ],
    kind: "local",
    name: "admin-local",
    targets: ["production", "dev"],
  },
  {
    files: [
      "e2e/task17Production.spec.ts",
      "e2e/task17CeremoniesProduction.spec.ts",
      "e2e/task17AdvancedProduction.spec.ts",
      "e2e/impersonationProduction.spec.ts",
    ],
    kind: "local",
    name: "task17-advanced",
    targets: ["production", "dev"],
  },
  {
    files: [
      "e2e/task19AccountLoginAccessibility.spec.ts",
      "e2e/task19LandmarkSweep.spec.ts",
      "e2e/demoHub.spec.ts",
      "e2e/emailPreview.spec.ts",
    ],
    kind: "local",
    name: "accessibility",
    targets: ["production", "dev"],
  },
]

const liveSuites: readonly E2eSuite[] = [
  {
    files: ["e2e/productionAuthentication.spec.ts"],
    kind: "live",
    name: "productionAuthentication",
    targets: ["production", "dev"],
  },
  {
    files: ["e2e/productionAccountRegression.spec.ts"],
    kind: "live",
    name: "productionAccountRegression",
    targets: ["production", "dev"],
  },
]

type E2eWorkflowSuite = {
  readonly name: string
  readonly targets: readonly E2eTarget[]
}

const workflowSuites: readonly E2eWorkflowSuite[] = [
  { name: "adminOrgOwner", targets: ["production", "dev"] },
  { name: "adminMemberDenied", targets: ["production", "dev"] },
  { name: "adminOrgAdminLimits", targets: ["production", "dev"] },
  { name: "adminRealmAdministrator", targets: ["production", "dev"] },
  { name: "adminInvitations", targets: ["dev"] },
]

function e2eWorkflowDirectoryExists(workflowName: string): boolean {
  try {
    return existsSync(join("e2e", "workflows", workflowName))
  } catch {
    return false
  }
}

export function e2eSuiteRegistryList(options: E2eSuiteRegistryListOptions = {}): E2eSuite[] {
  const workflowExists = options.workflowExists ?? e2eWorkflowDirectoryExists
  const workflows: E2eSuite[] = workflowSuites.flatMap((suite) => {
    if (!workflowExists(suite.name)) return []
    return [
      {
        files: [`e2e/workflows/${suite.name}/${suite.name}.spec.ts`],
        kind: "live" as const,
        name: suite.name,
        targets: suite.targets,
      },
    ]
  })
  return [...localSuites, ...liveSuites, ...workflows]
}
