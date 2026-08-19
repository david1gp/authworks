import { useLocation, useNavigate } from "@solidjs/router"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import * as v from "valibot"
import { demoAdminOrganizations } from "../../demo/demoAdminOrganizations.js"
import { demoAdminProjects } from "../../demo/demoAdminProjects.js"
import { demoRealmId } from "../../demo/demoRealmId.js"
import { demoResourceIdGenerate } from "../../demo/demoResourceIdGenerate.js"
import { projectCreateRequestSchema } from "../public/projectCreateRequestSchema.js"
import type { Project } from "../public/projectSchema.js"

const createSchema = v.picklist(["1", "project"])

export function projectListStateCreate() {
  const location = useLocation()
  const navigate = useNavigate()
  const projects = createSignalObject<Project[]>([...demoAdminProjects])
  const query = createSignalObject(searchQueryGet(location.search))
  const name = createSignalObject("")
  const organizationId = createSignalObject(demoAdminOrganizations[0]?.id ?? "")
  const error = createSignalObject<string | undefined>(undefined)
  const filteredProjects = () => {
    const value = query.get().toLowerCase()
    if (!value) return projects.get()
    return projects
      .get()
      .filter((project) => `${project.name} ${project.id} ${project.organizationId}`.toLowerCase().includes(value))
  }
  const organizationName = (id: string) =>
    demoAdminOrganizations.find((organization) => organization.id === id)?.name ?? id
  const searchSet = (value: string) => {
    query.set(value)
    const url = new URL(window.location.href)
    if (value) url.searchParams.set("q", value)
    else url.searchParams.delete("q")
    window.history.replaceState({}, "", url)
  }
  const createOpenSet = (open: boolean) => {
    const params = new URLSearchParams(location.search)
    if (open) params.set("create", "project")
    else params.delete("create")
    const search = params.toString()
    navigate(`${location.pathname}${search ? `?${search}` : ""}`, { replace: true })
    error.set(undefined)
  }
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    const result = v.safeParse(projectCreateRequestSchema, { name: name.get(), organizationId: organizationId.get() })
    if (!result.success) {
      error.set("Enter a project name and choose an organization.")
      return
    }
    const timestamp = Date.now()
    const project: Project = {
      authorizationRequired: false,
      createdAt: timestamp,
      id: demoResourceIdGenerate(),
      realmId: demoRealmId,
      name: result.output.name,
      organizationId: result.output.organizationId,
      projectAccessRequired: false,
      status: "active",
      updatedAt: timestamp,
    }
    demoAdminProjects.push(project)
    projects.set([...projects.get(), project])
    name.set("")
    createOpenSet(false)
  }
  const openProject = (id: string) => navigate(`/demo/admin/projects/${id}`)

  // Production would use projectApiClientCreate here instead of the in-memory append.
  return {
    badgeVariant: (status: "active" | "inactive" | "removed") =>
      (({ active: "filledGreen", inactive: "filledYellow", removed: "filledRed" }) as const)[status],
    createOpen: () => createValueGet(location.search) !== undefined,
    createOpenSet,
    error: error.get,
    filteredProjects,
    name: name.get,
    onName: name.set,
    onOrganizationId: organizationId.set,
    openProject,
    organizationId,
    organizationName,
    organizations: demoAdminOrganizations,
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
  const result = v.safeParse(createSchema, new URLSearchParams(search).get("create"))
  return result.success ? result.output : undefined
}
