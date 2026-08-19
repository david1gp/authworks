import { useParams } from "@solidjs/router"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { demoAdminMemberships } from "../../demo/demoAdminMemberships.js"
import { demoAdminOrganizations } from "../../demo/demoAdminOrganizations.js"
import { demoAdminUsers } from "../../demo/demoAdminUsers.js"

export function organizationDetailStateCreate() {
  const params = useParams<{ organizationId: string }>()
  const organization = () => demoAdminOrganizations.find((item) => item.id === params.organizationId)
  const memberships = createSignalObject(
    demoAdminMemberships.filter((item) => item.organizationId === params.organizationId),
  )
  const users = demoAdminUsers
  return {
    backHref: "/demo/admin/organizations",
    memberships,
    organization,
    statusVariant: (status: "active" | "inactive" | "removed") =>
      (({ active: "filledGreen", inactive: "filledYellow", removed: "filledRed" }) as const)[status],
    userName: (userId: string) => users.find((user) => user.id === userId)?.profile.displayName ?? userId,
  }
}
