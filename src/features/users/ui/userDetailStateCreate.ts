import { useParams } from "@solidjs/router"
import { demoAdminUsers } from "../../demo/demoAdminUsers.js"

export function userDetailStateCreate() {
  const params = useParams<{ userId: string }>()
  return {
    backHref: "/demo/admin/users",
    stateVariant: (state: "initial" | "active" | "inactive" | "locked" | "suspended" | "deleted") =>
      (
        ({
          initial: "subtle",
          active: "filledGreen",
          inactive: "filledYellow",
          locked: "filledRed",
          suspended: "filledYellow",
          deleted: "filledRed",
        }) as const
      )[state],
    user: () => demoAdminUsers.find((item) => item.id === params.userId),
  }
}
