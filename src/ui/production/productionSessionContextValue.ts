import type { ProductionContextOption } from "./productionContextOption.js"
import type { ProductionImpersonationContext } from "./productionImpersonationContext.js"
import type { ProductionRouteGuardContext } from "./productionRouteGuardContext.js"

export type ProductionSessionContextValue = {
  readonly actorLabel: string
  readonly guard: ProductionRouteGuardContext
  readonly impersonation: ProductionImpersonationContext | null
  readonly organizations: readonly ProductionContextOption[]
  readonly organizationSelect: (organizationId: string) => void
  readonly realms: readonly ProductionContextOption[]
  readonly realmSelect: (realmId: string) => void
}
