import type { Accessor } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"
import type { User } from "../../users/public/userSchema.js"

export function accountRecoveryAccessStateCreate(options: {
  readonly methods: Accessor<UserAuthenticationMethods>
  readonly user: Accessor<User | undefined>
}) {
  const statusCreate = (label: string, detail: string, configured: boolean) => ({ configured, detail, label })
  const statuses = () => {
    const methods = options.methods()
    const user = options.user()
    const emailConfigured = user?.emailVerified === true
    const phoneNumber = user?.phoneNumber
    const phoneConfigured = phoneNumber !== undefined && user?.phoneNumberVerifiedAt !== undefined
    const backupCodeCount = methods.recoveryCodes.remaining
    return [
      statusCreate(
        messageTranslate("account.securityOverview.password"),
        messageTranslate(
          methods.password.available
            ? "account.securityOverview.passwordSet"
            : "account.securityOverview.passwordMissing",
        ),
        methods.password.available,
      ),
      statusCreate(
        messageTranslate("account.securityOverview.email"),
        emailConfigured
          ? messageTranslate("account.securityOverview.emailVerified", { email: user.email })
          : messageTranslate("account.securityOverview.emailMissing"),
        emailConfigured,
      ),
      statusCreate(
        messageTranslate("account.securityOverview.phone"),
        phoneConfigured
          ? messageTranslate("account.securityOverview.phoneVerified", { phone: phoneNumber })
          : messageTranslate("account.securityOverview.phoneMissing"),
        phoneConfigured,
      ),
      statusCreate(
        messageTranslate("account.securityOverview.backupCodes"),
        messageTranslate("account.securityOverview.backupCodeCount", { count: backupCodeCount }),
        backupCodeCount > 0,
      ),
    ]
  }
  return { statuses }
}
