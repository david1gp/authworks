import { useLocation } from "@solidjs/router"
import { createMemo, createSignal } from "solid-js"
import type { AuthenticatedDataTableSort } from "../authenticatedDataTableSort.js"
import { authenticatedUrlSearchParamWrite } from "../authenticatedUrlSearchParamWrite.js"
import type { DemoUiKitTableRow, DemoUiKitTableSection, DemoUiKitTableTab } from "./demoUiKitQuerySchema.js"
import { demoUiKitQueryParse } from "./demoUiKitQuerySchema.js"
import { demoUiKitTableRows } from "./demoUiKitTableRows.js"

type DemoUiKitTableColumnKey = "name" | "role" | "lastSignInAt" | "createdAt"

const tableRowTextHaystack = (row: DemoUiKitTableRow): string =>
  `${row.name} ${row.email} ${row.role} ${row.state}`.toLowerCase()

const tableRowsSort = (rows: readonly DemoUiKitTableRow[], sort: AuthenticatedDataTableSort): DemoUiKitTableRow[] => {
  const key = sort.key as DemoUiKitTableColumnKey
  const direction = sort.direction === "asc" ? 1 : -1
  return [...rows].sort((left, right) => {
    const leftValue = key === "name" ? left.name : key === "role" ? left.role : left[key]
    const rightValue = key === "name" ? right.name : key === "role" ? right.role : right[key]
    if (typeof leftValue === "number" && typeof rightValue === "number") return (leftValue - rightValue) * direction
    return String(leftValue).localeCompare(String(rightValue)) * direction
  })
}

/**
 * Local showcase state for the authenticated UI kit: URL-backed search, sort, tab, and section
 * plus toggles for the skeleton and empty presentations.
 */
export function authenticatedUiKitDemoStateCreate() {
  const location = useLocation()
  const [loading, setLoading] = createSignal(false)
  const [forceEmpty, setForceEmpty] = createSignal(false)
  const [selectedRole, setSelectedRole] = createSignal<string | undefined>(undefined)
  const [actionMessage, setActionMessage] = createSignal<string | undefined>(undefined)

  const query = () => demoUiKitQueryParse(location.search)
  const search = () => query().q ?? ""
  const activeTab = (): DemoUiKitTableTab => query().tab
  const activeSection = (): DemoUiKitTableSection => query().section
  const activeSort = createMemo((): AuthenticatedDataTableSort | undefined => {
    const parsed = query()
    if (parsed.sort === undefined || parsed.dir === undefined) return undefined
    return { direction: parsed.dir, key: parsed.sort }
  })

  const rows = createMemo((): readonly DemoUiKitTableRow[] => {
    if (forceEmpty()) return []
    const term = search().trim().toLowerCase()
    const filtered = demoUiKitTableRows.filter((row) => term.length === 0 || tableRowTextHaystack(row).includes(term))
    const sort = activeSort()
    return sort === undefined ? filtered : tableRowsSort(filtered, sort)
  })

  const searchInput = (value: string) => authenticatedUrlSearchParamWrite("q", value)

  const sortChange = (sort: AuthenticatedDataTableSort) => {
    authenticatedUrlSearchParamWrite("sort", sort.key)
    authenticatedUrlSearchParamWrite("dir", sort.direction)
  }

  const tabSelect = (value: DemoUiKitTableTab) => {
    authenticatedUrlSearchParamWrite("tab", value)
  }

  const sectionSelect = (value: DemoUiKitTableSection) => {
    authenticatedUrlSearchParamWrite("section", value)
  }

  const roleSelect = (role: string) => {
    setSelectedRole((current) => (current === role ? undefined : role))
    setActionMessage(undefined)
  }

  const menuSelect = (label: string) => setActionMessage(label)

  const toggleLoading = () => {
    setLoading((current) => !current)
  }

  const toggleEmpty = () => {
    setForceEmpty((current) => !current)
  }

  return {
    rows,
    search,
    activeSort,
    activeTab,
    activeSection,
    loading,
    forceEmpty,
    selectedRole,
    actionMessage,
    searchInput,
    sortChange,
    tabSelect,
    sectionSelect,
    roleSelect,
    menuSelect,
    toggleLoading,
    toggleEmpty,
  }
}
