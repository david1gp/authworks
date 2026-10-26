import { OidcConsentProductionView } from "./OidcConsentProductionView.js"
import { oidcConsentProductionStateCreate } from "./oidcConsentProductionStateCreate.js"

export function ConsentProductionAdapter() {
  return <OidcConsentProductionView state={oidcConsentProductionStateCreate()} />
}
