import type { ProductionApiContextValue } from "./productionApiContextValue.js"
import type { ProductionSessionContextValue } from "./productionSessionContextValue.js"

const noOperation = () => undefined
const noOrganizationSelection = async () => ({ success: true as const, data: undefined })

export const productionShellContextDefault = {
  api: {
    content: "empty",
    retry: noOperation,
  } satisfies ProductionApiContextValue,
  session: {
    actorLabel: "Avery Stone",
    guard: {
      authentication: { status: "authenticated", userId: "shell-user" },
      organization: { status: "available", organizationId: "northwind" },
      permission: "granted",
      realm: { status: "available", realmId: "customer-identity" },
    },
    impersonation: null,
    organizations: [
      { id: "northwind", label: "Northwind Labs" },
      { id: "field-notes", label: "Field Notes" },
    ],
    organizationSelect: noOrganizationSelection,
    organizationSwitchPending: () => false,
    realms: [{ id: "customer-identity", label: "Customer identity" }],
  } satisfies ProductionSessionContextValue,
}
