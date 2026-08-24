import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ExternalIdentityLoginStatus } from "../public/externalIdentityLoginStatusSchema.js"

type ExternalIdentityLoginCopy = {
  readonly description?: string
  readonly failureDescription?: string
  readonly title: string
}

export function externalIdentityLoginCopyGet(
  status: ExternalIdentityLoginStatus,
  displayName: string,
): ExternalIdentityLoginCopy {
  if (status === "account-not-found") {
    return {
      description: messageTranslate("login.provider.accountNotFoundDescription", { provider: displayName }),
      title: messageTranslate("login.provider.accountNotFoundTitle"),
    }
  }
  if (status === "linking-failed" || status === "registration-failed") {
    return {
      description: messageTranslate("login.provider.linkingFailedDescription"),
      title: messageTranslate("login.provider.linkingFailedTitle"),
    }
  }
  if (status === "failure") {
    return {
      failureDescription: messageTranslate("login.provider.failureDescription", { provider: displayName }),
      title: messageTranslate("login.provider.title", { provider: displayName }),
    }
  }
  return {
    description: messageTranslate("login.provider.description", { provider: displayName }),
    title: messageTranslate("login.provider.title", { provider: displayName }),
  }
}
