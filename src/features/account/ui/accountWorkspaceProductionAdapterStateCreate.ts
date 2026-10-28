import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { accountProductionAdapterStateCreate } from "./accountProductionAdapterStateCreate.js"
import { accountSecurityProductionStateCreate } from "./accountSecurityProductionStateCreate.js"
import { accountSecurityProgressStateCreate } from "./accountSecurityProgressStateCreate.js"
import { accountWorkspaceAdministrationHrefGet } from "./accountWorkspaceAdministrationHrefGet.js"

export function accountWorkspaceProductionAdapterStateCreate(realmId: () => string) {
  const session = productionSessionContextGet()
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

  return {
    administrationHref: () => accountWorkspaceAdministrationHrefGet(session.guard),
    profile,
    security,
    securityProgress,
    userLabel: () => {
      const user = profile.user.get()
      return user?.profile.displayName || user?.email || user?.userName || ""
    },
  }
}
