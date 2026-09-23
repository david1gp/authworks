import { accountDemoAdapterStateCreate } from "./accountDemoAdapterStateCreate.js"
import { accountSecurityDemoStateCreate } from "./accountSecurityDemoStateCreate.js"
import { accountSecurityProgressStateCreate } from "./accountSecurityProgressStateCreate.js"

export function accountWorkspaceDemoAdapterStateCreate() {
  const profile = accountDemoAdapterStateCreate(() => "email")
  const security = accountSecurityDemoStateCreate(() => "overview")
  const securityProgress = accountSecurityProgressStateCreate({
    methods: security.methods,
    passkeyCount: () => security.passkeys().length,
    user: security.user,
  })

  return { profile, security, securityProgress }
}
