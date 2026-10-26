import { createSignalObject } from "#ui/utils/createSignalObject.js"

/** View state for the sidebar identity menu: popover open state that closes on selection. */
export function productionIdentityMenuStateCreate(options: { readonly onNavigate: () => void }) {
  const open = createSignalObject(false)

  return {
    open: open.get,
    openChange: (next: boolean) => open.set(next),
    select: () => {
      open.set(false)
      options.onNavigate()
    },
  }
}
