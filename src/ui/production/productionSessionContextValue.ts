import type { Accessor } from "solid-js"
import type { Result } from "#result"
import type { ProductionContextOption } from "./productionContextOption.js"
import type { ProductionImpersonationContext } from "./productionImpersonationContext.js"
import type { ProductionRouteGuardContext } from "./productionRouteGuardContext.js"

export type ProductionSessionContextValue = {
  readonly actorLabel: string
  readonly guard: ProductionRouteGuardContext
  readonly impersonation: ProductionImpersonationContext | null
  readonly organizations: readonly ProductionContextOption[]
  readonly organizationSelect: (organizationId: string) => Promise<Result<void>>
  readonly organizationSwitchPending: Accessor<boolean>
  readonly realms: readonly ProductionContextOption[]
}
