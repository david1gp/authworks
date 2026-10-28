import type { Accessor } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"
import { accountSecuritySectionIds } from "./accountSecuritySectionIds.js"

export function accountSecurityProgressStateCreate(options: {
  readonly identitiesCount: Accessor<number>
  readonly methods: Accessor<UserAuthenticationMethods>
  readonly passkeyCount: Accessor<number>
}) {
  const statuses = () => {
    const methods = options.methods()
    const passkeyCount = options.passkeyCount()
    const identitiesCount = options.identitiesCount()
    const totpEnrollments = methods.totp.enrollments.length
    const backupCodeCount = methods.recoveryCodes.remaining
    return [
      {
        configured: methods.password.available,
        detail: messageTranslate(
          methods.password.available
            ? "account.securityOverview.passwordSet"
            : "account.securityOverview.passwordMissing",
        ),
        href: `#${accountSecuritySectionIds.password}`,
        label: messageTranslate("account.securityOverview.password"),
      },
      {
        configured: passkeyCount > 0,
        detail: messageTranslate("account.securityOverview.passkeyCount", { count: passkeyCount }),
        href: `#${accountSecuritySectionIds.passkeys}`,
        label: messageTranslate("account.securityOverview.passkeys"),
      },
      {
        configured: methods.totp.enrolled,
        detail: methods.totp.enrolled
          ? messageTranslate("account.factors.count", { count: totpEnrollments })
          : messageTranslate("account.factors.missing"),
        href: `#${accountSecuritySectionIds.factors}`,
        label: messageTranslate("account.factors.authenticator"),
      },
      {
        configured: identitiesCount > 0,
        detail: messageTranslate("account.security.identityCount", { count: identitiesCount }),
        href: `#${accountSecuritySectionIds.identities}`,
        label: messageTranslate("shell.nav.linkedIdentities"),
      },
      {
        configured: backupCodeCount > 0,
        detail: messageTranslate("account.securityOverview.backupCodeCount", { count: backupCodeCount }),
        href: `#${accountSecuritySectionIds.recoveryCodes}`,
        label: messageTranslate("account.securityOverview.backupCodes"),
      },
    ]
  }
  const configuredCount = () => statuses().filter((status) => status.configured).length
  const text = () => messageTranslate("account.security.progress", { count: configuredCount() })
  const accessibleLabel = () => messageTranslate("account.security.progressLabel", { count: configuredCount() })
  const width = () => `${configuredCount() * 20}%`
  const items = () => statuses()
  return { accessibleLabel, configuredCount, items, text, width }
}
