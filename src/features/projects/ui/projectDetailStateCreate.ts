import { useLocation, useNavigate, useParams } from "@solidjs/router"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import * as v from "valibot"
import { demoAdminOrganizations } from "../../demo/demoAdminOrganizations.js"
import { demoAdminProjectRoles } from "../../demo/demoAdminProjectRoles.js"
import { demoAdminProjects } from "../../demo/demoAdminProjects.js"
import { demoRealmId } from "../../demo/demoRealmId.js"
import { demoResourceIdGenerate } from "../../demo/demoResourceIdGenerate.js"
import { projectRoleCreateRequestSchema } from "../public/projectRoleCreateRequestSchema.js"

const createSchema = v.picklist(["1", "role"])

export function projectDetailStateCreate() {
  const params = useParams<{ projectId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const project = () => demoAdminProjects.find((item) => item.id === params.projectId)
  const roles = createSignalObject(demoAdminProjectRoles.filter((role) => role.projectId === params.projectId))
  const key = createSignalObject("")
  const displayName = createSignalObject("")
  const group = createSignalObject("")
  const error = createSignalObject<string | undefined>(undefined)
  const createOpenSet = (open: boolean) => {
    const searchParams = new URLSearchParams(location.search)
    if (open) searchParams.set("create", "role")
    else searchParams.delete("create")
    const search = searchParams.toString()
    navigate(`${location.pathname}${search ? `?${search}` : ""}`, { replace: true })
    error.set(undefined)
  }
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    const result = v.safeParse(projectRoleCreateRequestSchema, {
      displayName: displayName.get(),
      group: group.get() || undefined,
      key: key.get(),
    })
    if (!result.success) {
      error.set("Enter a role key and display name.")
      return
    }
    const timestamp = Date.now()
    roles.set([
      ...roles.get(),
      {
        createdAt: timestamp,
        displayName: result.output.displayName,
        ...(result.output.group ? { group: result.output.group } : {}),
        id: demoResourceIdGenerate(),
        realmId: demoRealmId,
        key: result.output.key,
        projectId: params.projectId,
        updatedAt: timestamp,
      },
    ])
    key.set("")
    displayName.set("")
    group.set("")
    createOpenSet(false)
  }
  // Production would use projectApiClientCreate here instead of the in-memory role append.
  return {
    createOpen: () => {
      const result = v.safeParse(createSchema, new URLSearchParams(location.search).get("create"))
      return result.success
    },
    createOpenSet,
    displayName: displayName.get,
    error: error.get,
    group: group.get,
    key: key.get,
    onDisplayName: displayName.set,
    onGroup: group.set,
    onKey: key.set,
    organizationName: (id: string) => demoAdminOrganizations.find((organization) => organization.id === id)?.name ?? id,
    project,
    roles,
    statusVariant: (status: "active" | "inactive" | "removed") =>
      (({ active: "filledGreen", inactive: "filledYellow", removed: "filledRed" }) as const)[status],
    submit,
  }
}
