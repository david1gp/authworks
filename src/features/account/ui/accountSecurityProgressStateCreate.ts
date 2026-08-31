import type { Accessor } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"
import type { User } from "../../users/public/userSchema.js"
import { accountRecoveryAccessStateCreate } from "./accountRecoveryAccessStateCreate.js"

export function accountSecurityProgressStateCreate(options: {
  readonly methods: Accessor<UserAuthenticationMethods>
  readonly passkeyCount: Accessor<number>
  readonly user: Accessor<User | undefined>
}) {
  const recoveryAccess = accountRecoveryAccessStateCreate({ methods: options.methods, user: options.user })
  const configuredCount = () =>
    recoveryAccess.statuses().filter((status) => status.configured).length + (options.passkeyCount() > 0 ? 1 : 0)
  const text = () => messageTranslate("account.security.progress", { count: configuredCount() })
  const accessibleLabel = () => messageTranslate("account.security.progressLabel", { count: configuredCount() })
  const width = () => `${configuredCount() * 20}%`
  return { accessibleLabel, configuredCount, text, width }
}
