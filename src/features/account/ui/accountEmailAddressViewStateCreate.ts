import type { Accessor } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { UserEmailAddress } from "../../users/public/userEmailAddressSchema.js"

/** Presentation-only selection; account mutations and verification challenges remain adapter-owned. */
export function accountEmailAddressViewStateCreate(addresses: Accessor<readonly UserEmailAddress[]>) {
  const selectedId = createSignalObject<string | undefined>(undefined)
  const primary = () => addresses().find((address) => address.isPrimary)
  const summaryValue = () => primary()?.email ?? messageTranslate("account.profile.emailMissing")
  const summaryStatus = () => {
    const address = primary()
    if (address === undefined) return messageTranslate("account.profile.notSet")
    return messageTranslate(address.verified ? "account.profile.verified" : "account.profile.verificationPending")
  }
  const summaryTone = () => (primary()?.verified ? "success" : "neutral")
  const dialogOpen = (id: string) => selectedId.get() === id && addresses().some((address) => address.id === id)
  const dialogOpenChange = (id: string, open: boolean) => {
    if (open) {
      selectedId.set(id)
      return
    }
    if (selectedId.get() === id) selectedId.set(undefined)
  }

  return { dialogOpen, dialogOpenChange, summaryStatus, summaryTone, summaryValue }
}
