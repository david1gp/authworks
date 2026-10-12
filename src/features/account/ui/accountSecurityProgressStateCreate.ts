import type { Accessor } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"
import type { User } from "../../users/public/userSchema.js"
import { accountRecoveryAccessStateCreate } from "./accountRecoveryAccessStateCreate.js"
import { accountWorkspaceSectionIds } from "./accountWorkspaceSectionIds.js"
import { accountSecuritySectionIds } from "./accountSecuritySectionIds.js"

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
  const items = () => {
    const [password, email, phone, backupCodes] = recoveryAccess.statuses()
    const passkeyCount = options.passkeyCount()
    return [
      { ...password!, href: `#${accountSecuritySectionIds.password}` },
      // Email and phone numbers are managed in the profile section; the overview links there
      // because the security grid has no dedicated card for them.
      { ...email!, href: `#${accountWorkspaceSectionIds.profile}` },
      { ...phone!, href: `#${accountWorkspaceSectionIds.profile}` },
      { ...backupCodes!, href: `#${accountSecuritySectionIds.recoveryCodes}` },
      {
        configured: passkeyCount > 0,
        detail: messageTranslate("account.securityOverview.passkeyCount", { count: passkeyCount }),
        href: `#${accountSecuritySectionIds.passkeys}`,
        label: messageTranslate("account.securityOverview.passkeys"),
      },
    ]
  }
  return { accessibleLabel, configuredCount, items, text, width }
}
