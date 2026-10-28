import { onCleanup } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"

/** Local clipboard and removal state; claim lifecycle is owned by the screen. */
export function organizationConfigurationDomainsSectionStateCreate() {
  const removeTarget = createSignalObject<string | undefined>(undefined)
  const copied = createSignalObject(false)
  let copyTimer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(copyTimer))

  return {
    copied: copied.get,
    copyRecord: async (value: string) => {
      try {
        await navigator.clipboard.writeText(value)
        clearTimeout(copyTimer)
        copied.set(true)
        copyTimer = setTimeout(() => copied.set(false), 2000)
      } catch {
        copied.set(false)
      }
    },
    removeTarget: removeTarget.get,
    removalOpen: (domain: string) => removeTarget.set(domain),
    removalClose: () => removeTarget.set(undefined),
  }
}
