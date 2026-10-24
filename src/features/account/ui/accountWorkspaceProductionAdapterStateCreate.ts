import { accountProductionAdapterStateCreate } from "./accountProductionAdapterStateCreate.js"
import { accountSecurityProductionStateCreate } from "./accountSecurityProductionStateCreate.js"
import { accountSecurityProgressStateCreate } from "./accountSecurityProgressStateCreate.js"

export function accountWorkspaceProductionAdapterStateCreate(realmId: () => string) {
  const profile = accountProductionAdapterStateCreate(() => "overview", { realmId: realmId() })
  const security = accountSecurityProductionStateCreate({
    onIdentityLinked: () => void profile.load(true),
    realmId,
    screen: () => "overview",
  })
  const securityProgress = accountSecurityProgressStateCreate({
    methods: security.methods,
    passkeyCount: () => security.passkeys().length,
    user: security.user,
  })

  return { profile, security, securityProgress }
}
