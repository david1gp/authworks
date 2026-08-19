import { useLocation, useNavigate } from "@solidjs/router"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import * as v from "valibot"
import { organizationCreateRequestSchema } from "../public/organizationCreateRequestSchema.js"
import { demoAdminOrganizations } from "../../demo/demoAdminOrganizations.js"
import { demoResourceIdGenerate } from "../../demo/demoResourceIdGenerate.js"
import { demoRealmId } from "../../demo/demoRealmId.js"

const createSchema = v.picklist(["1", "organization"])

export function organizationListStateCreate() {
  const location = useLocation()
  const navigate = useNavigate()
  const organizations = createSignalObject([...demoAdminOrganizations])
  const query = createSignalObject(searchQueryGet(location.search))
  const name = createSignalObject("")
  const error = createSignalObject<string | undefined>(undefined)

  const createOpen = () => createValueGet(location.search) !== undefined
  const filteredOrganizations = () => {
    const value = query.get().toLowerCase()
    if (!value) return organizations.get()
    return organizations
      .get()
      .filter((organization) => `${organization.name} ${organization.id}`.toLowerCase().includes(value))
  }
  const searchSet = (value: string) => {
    query.set(value)
    const url = new URL(window.location.href)
    if (value) url.searchParams.set("q", value)
    else url.searchParams.delete("q")
    window.history.replaceState({}, "", url)
  }
  const createOpenSet = (open: boolean) => {
    const params = new URLSearchParams(location.search)
    if (open) params.set("create", "organization")
    else params.delete("create")
    const search = params.toString()
    navigate(`${location.pathname}${search ? `?${search}` : ""}`, { replace: true })
    error.set(undefined)
  }
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    const result = v.safeParse(organizationCreateRequestSchema, { name: name.get() })
    if (!result.success) {
      error.set("Enter an organization name.")
      return
    }
    const timestamp = Date.now()
    const organization = {
      createdAt: timestamp,
      id: demoResourceIdGenerate(),
      realmId: demoRealmId,
      name: result.output.name,
      status: "active" as const,
      updatedAt: timestamp,
    }
    demoAdminOrganizations.push(organization)
    organizations.set([...organizations.get(), organization])
    name.set("")
    createOpenSet(false)
  }
  const openOrganization = (organizationId: string) => navigate(`/demo/admin/organizations/${organizationId}`)

  // Production would use organizationApiClientCreate here instead of the in-memory append.
  return {
    badgeVariant: (status: "active" | "inactive" | "removed") =>
      (({ active: "filledGreen", inactive: "filledYellow", removed: "filledRed" }) as const)[status],
    createOpen,
    createOpenSet,
    error: error.get,
    filteredOrganizations,
    name: name.get,
    onName: name.set,
    openOrganization,
    query: query.get,
    searchSet,
    submit,
  }
}

function searchQueryGet(search: string): string {
  const value = new URLSearchParams(search).get("q")
  const result = v.safeParse(v.optional(v.string()), value ?? undefined)
  return result.success ? (result.output ?? "") : ""
}

function createValueGet(search: string): string | undefined {
  const value = new URLSearchParams(search).get("create")
  const result = v.safeParse(createSchema, value)
  return result.success ? result.output : undefined
}
