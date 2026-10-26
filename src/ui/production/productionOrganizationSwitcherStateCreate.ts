import { createMemo } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { authenticatedAvatarColorGet } from "../authenticated/authenticatedAvatarColorGet.js"
import { authenticatedInitialsGet } from "../authenticated/authenticatedInitialsGet.js"
import type { ProductionContextOption } from "./productionContextOption.js"

/** Lists longer than this get a filter field at the top of the menu. */
const organizationSwitcherSearchThreshold = 7

/**
 * View state for the sidebar organization switcher: a workspace-style trigger with an initials
 * tile, and a popover listbox with optional filtering and roving arrow-key focus.
 */
export function productionOrganizationSwitcherStateCreate(options: {
  readonly activeId: () => string
  readonly disabled: () => boolean
  readonly onSelect: (organizationId: string) => void
  readonly organizations: () => readonly ProductionContextOption[]
}) {
  const open = createSignalObject(false)
  const query = createSignalObject("")

  const active = createMemo(
    () => options.organizations().find((item) => item.id === options.activeId()) ?? options.organizations()[0],
  )

  const filtered = createMemo(() => {
    const needle = query.get().trim().toLocaleLowerCase()
    if (needle.length === 0) return options.organizations()
    return options.organizations().filter((item) => item.label.toLocaleLowerCase().includes(needle))
  })

  const optionsGet = (current: HTMLElement): readonly HTMLElement[] => {
    const container = current.closest("[data-organization-switcher-menu]")
    if (container === null) return []
    return [...container.querySelectorAll<HTMLElement>("[role='option']")]
  }

  const optionFocus = (current: HTMLElement, offset: number | "first" | "last") => {
    const items = optionsGet(current)
    if (items.length === 0) return
    if (offset === "first") return items[0]?.focus()
    if (offset === "last") return items[items.length - 1]?.focus()
    const index = items.indexOf(current)
    items[(index + offset + items.length) % items.length]?.focus()
  }

  return {
    activeLabel: () => active()?.label ?? "",
    activeImageUrl: () => active()?.imageUrl,
    activeInitials: () => authenticatedInitialsGet(active()?.label ?? ""),
    activeTone: () => authenticatedAvatarColorGet(active()?.label ?? ""),
    filtered,
    imageUrl: (organizationId: string) => options.organizations().find((item) => item.id === organizationId)?.imageUrl,
    isActive: (organizationId: string) => organizationId === active()?.id,
    initials: (label: string) => authenticatedInitialsGet(label),
    tone: (label: string) => authenticatedAvatarColorGet(label),
    open: open.get,
    openChange: (next: boolean) => {
      if (next && options.disabled()) return
      open.set(next)
      if (!next) query.set("")
    },
    query: query.get,
    queryInput: (event: InputEvent & { readonly currentTarget: HTMLInputElement }) =>
      query.set(event.currentTarget.value),
    searchVisible: () => options.organizations().length > organizationSwitcherSearchThreshold,
    select: (organizationId: string) => {
      open.set(false)
      query.set("")
      if (organizationId === active()?.id) return
      options.onSelect(organizationId)
    },
    /** Arrow keys move between options; ArrowDown from the filter field enters the list. */
    optionKeyDown: (event: KeyboardEvent & { readonly currentTarget: HTMLElement }) => {
      if (event.key === "ArrowDown") {
        event.preventDefault()
        optionFocus(event.currentTarget, 1)
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        optionFocus(event.currentTarget, -1)
      } else if (event.key === "Home") {
        event.preventDefault()
        optionFocus(event.currentTarget, "first")
      } else if (event.key === "End") {
        event.preventDefault()
        optionFocus(event.currentTarget, "last")
      }
    },
    searchKeyDown: (event: KeyboardEvent & { readonly currentTarget: HTMLElement }) => {
      if (event.key !== "ArrowDown") return
      event.preventDefault()
      optionFocus(event.currentTarget, "first")
    },
  }
}
