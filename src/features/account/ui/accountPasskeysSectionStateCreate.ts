import type { Accessor } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { PasskeyCredential } from "../../passkeys/public/passkeyCredentialSchema.js"

/** Presentation-only selection; registration and revocation remain owned by the security adapter. */
export function accountPasskeysSectionStateCreate(passkeys: Accessor<readonly PasskeyCredential[]>) {
  const selectedId = createSignalObject<string | undefined>(undefined)
  const addOpen = createSignalObject(false)
  const count = () => passkeys().length
  const dialogOpen = (id: string) => selectedId.get() === id && passkeys().some((credential) => credential.id === id)
  const dialogOpenChange = (id: string, open: boolean) => {
    if (open) {
      addOpen.set(false)
      selectedId.set(id)
      return
    }
    if (selectedId.get() === id) selectedId.set(undefined)
  }
  const addDialogOpenChange = (open: boolean) => {
    if (open) selectedId.set(undefined)
    addOpen.set(open)
  }

  return {
    addDialogOpen: addOpen.get,
    addDialogOpenChange,
    count,
    dialogOpen,
    dialogOpenChange,
    summaryStatus: () => messageTranslate(count() > 0 ? "account.status.configured" : "account.status.notConfigured"),
    summaryTone: () => (count() > 0 ? ("success" as const) : ("neutral" as const)),
    summaryValue: () => messageTranslate("account.securityOverview.passkeyCount", { count: count() }),
  }
}
