import * as v from "valibot"

export const demoUiKitTableRowSchema = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string(),
  role: v.picklist(["owner", "admin", "member", "guest"]),
  state: v.picklist(["active", "suspended"]),
  lastSignInAt: v.number(),
  createdAt: v.number(),
})

export type DemoUiKitTableRow = v.InferOutput<typeof demoUiKitTableRowSchema>

const demoUiKitTableTabSchema = v.optional(v.picklist(["people", "service-accounts", "invitations"]), "people")

const demoUiKitTableSectionSchema = v.optional(v.picklist(["general", "branding", "domains"]), "general")

const demoUiKitQuerySchema = v.object({
  sort: v.optional(v.string()),
  dir: v.optional(v.picklist(["asc", "desc"])),
  q: v.optional(v.string()),
  tab: demoUiKitTableTabSchema,
  section: demoUiKitTableSectionSchema,
})

export type DemoUiKitQuery = v.InferOutput<typeof demoUiKitQuerySchema>
export type DemoUiKitTableTab = DemoUiKitQuery["tab"]
export type DemoUiKitTableSection = DemoUiKitQuery["section"]

export function demoUiKitQueryParse(search: string): DemoUiKitQuery {
  const parameters = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  const parsed = v.safeParse(demoUiKitQuerySchema, {
    sort: parameters.get("sort") ?? undefined,
    dir: parameters.get("dir") ?? undefined,
    q: parameters.get("q") ?? undefined,
    tab: parameters.get("tab") ?? undefined,
    section: parameters.get("section") ?? undefined,
  })
  if (parsed.success) return parsed.output
  return { q: undefined, sort: undefined, dir: undefined, section: "general", tab: "people" }
}

export function demoUiKitTableRowParse(value: unknown): DemoUiKitTableRow {
  return v.parse(demoUiKitTableRowSchema, value)
}
