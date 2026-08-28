import type { accountSecurityDemoStateCreate } from "./accountSecurityDemoStateCreate.js"
import type { accountSecurityProductionStateCreate } from "./accountSecurityProductionStateCreate.js"

/** The demo and production security states share one accessor surface, so the sections accept both. */
export type AccountSecurityViewState =
  | ReturnType<typeof accountSecurityProductionStateCreate>
  | ReturnType<typeof accountSecurityDemoStateCreate>
