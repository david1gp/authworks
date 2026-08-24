import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { LoginPrimaryMethod } from "../model/loginPrimaryMethodsGet.js"
import { loginRecentAccountLastUsedMethodGet } from "../model/loginRecentAccountLastUsedMethodGet.js"
import type { LoginRecentAccount } from "../model/loginRecentAccountSchema.js"
import type { LoginDiscovery } from "./loginAdapter.js"

type MethodChooserStateOptions = {
  readonly discovery: () => LoginDiscovery
  readonly recentAccounts: () => readonly LoginRecentAccount[]
}

export function methodChooserStateCreate(options: MethodChooserStateOptions) {
  const provider = () => options.discovery().providers[0]
  const hasRecentAccounts = () => options.recentAccounts().length > 0
  const methodIsLastUsed = (method: LoginPrimaryMethod) => {
    const lastUsed = loginRecentAccountLastUsedMethodGet(options.recentAccounts())?.replace("_", "-")
    if (method === "external-identity") return false
    return method === lastUsed
  }
  const methodCopy = (method: LoginPrimaryMethod, selectedProvider?: LoginDiscovery["providers"][number]) => {
    if (method === "external-identity") {
      const displayName = selectedProvider?.displayName ?? provider()?.displayName ?? messageTranslate("app.name")
      return {
        detail: messageTranslate("login.chooser.providerDetail", { provider: displayName }),
        label: messageTranslate("login.chooser.providerLabel", { provider: displayName }),
      }
    }
    if (method === "email-otp") {
      return {
        detail: messageTranslate("login.chooser.emailOtpDetail"),
        label: messageTranslate("login.chooser.emailOtpLabel"),
      }
    }
    if (method === "passkey") {
      return {
        detail: messageTranslate("login.chooser.passkeyDetail"),
        label: messageTranslate("login.chooser.passkeyLabel"),
      }
    }
    return {
      detail: messageTranslate("login.chooser.passwordDetail"),
      label: messageTranslate("login.chooser.passwordLabel"),
    }
  }

  return { hasRecentAccounts, methodCopy, methodIsLastUsed, provider }
}
