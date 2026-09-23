import { OidcConsentDemoView } from "./OidcConsentDemoView.js"
import { oidcConsentDemoStateCreate } from "./oidcConsentDemoStateCreate.js"

export function OidcConsentDemoAdapter() {
  const state = oidcConsentDemoStateCreate()
  return <OidcConsentDemoView state={state} />
}
