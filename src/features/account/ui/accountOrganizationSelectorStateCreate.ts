import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationMe } from "../../organizations/public/organizationMeSchema.js"
import { accountOrganizationSelectorModeGet } from "./accountOrganizationSelectorModeGet.js"
import { accountOrganizationTabIndexResolve } from "./accountOrganizationTabIndexResolve.js"

/** Local view state of the organization tab list: roving focus, keyboard moves, and select fallback. */
export function accountOrganizationSelectorStateCreate(inputs: {
  readonly activeOrganizationId: () => string | undefined
  readonly onSelect: (organizationId: string) => void
  readonly organizations: () => readonly OrganizationMe[]
  readonly viewedOrganizationId: () => string | undefined
}) {
  const tabElements = new Map<string, HTMLButtonElement>()
  const selectValue = createSignalObject("")
  const organizationIds = () => inputs.organizations().map((item) => item.organization.id)
  const mode = () => accountOrganizationSelectorModeGet(inputs.organizations().length)
  const selectedIndex = () => {
    const index = organizationIds().indexOf(inputs.viewedOrganizationId() ?? "")
    return index < 0 ? 0 : index
  }
  const select = (organizationId: string) => {
    inputs.onSelect(organizationId)
    tabElements.get(organizationId)?.focus()
  }
  return {
    mode,
    organizationIds,
    selectValue: {
      get: () => inputs.viewedOrganizationId() ?? selectValue.get(),
      set: (organizationId: string) => {
        selectValue.set(organizationId)
        inputs.onSelect(organizationId)
      },
    },
    selected: (organizationId: string) => organizationId === inputs.viewedOrganizationId(),
    tabIndexGet: (organizationId: string) => (organizationIds()[selectedIndex()] === organizationId ? 0 : -1),
    tabKeyDown: (event: KeyboardEvent) => {
      const ids = organizationIds()
      const next = accountOrganizationTabIndexResolve({
        count: ids.length,
        index: selectedIndex(),
        key: event.key,
      })
      if (next === undefined) return
      const target = ids[next]
      if (target === undefined) return
      event.preventDefault()
      select(target)
    },
    tabRefSet: (organizationId: string, element: HTMLButtonElement) => {
      tabElements.set(organizationId, element)
    },
    tabSelect: select,
    valueText: (organizationId: string) => {
      const organization = inputs.organizations().find((item) => item.organization.id === organizationId)
      if (organization === undefined) return organizationId
      if (organization.organization.id !== inputs.activeOrganizationId()) return organization.organization.name
      return `${organization.organization.name} (${messageTranslate("account.access.active")})`
    },
  }
}
