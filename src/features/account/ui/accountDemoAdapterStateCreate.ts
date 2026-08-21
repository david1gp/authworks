import { useLocation } from "@solidjs/router"
import { type Accessor, createEffect } from "solid-js"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import type { UserProfileUpdateRequest } from "../../users/public/userProfileUpdateRequestSchema.js"
import { accountDemoUserFixture } from "./accountDemoUserFixture.js"
import { accountPageStateCreate } from "./accountPageStateCreate.js"

export function accountDemoAdapterStateCreate(
  kind: Accessor<"delete" | "email" | "overview" | "password" | "profile">,
) {
  const location = useLocation()
  const fixtureState = () => demoFixtureStateSelect(location.search, ["success", "loading", "error"])
  let fixtureUser = structuredClone(accountDemoUserFixture)
  const error = () =>
    resultErrorCodedCreate(
      "accountDemoFixture",
      "The deterministic account fixture is unavailable.",
      "platform.internal",
    )
  const page = accountPageStateCreate({
    adapter: {
      deleteAccount: async () => {
        if (fixtureState() === "error") return error()
        fixtureUser = { ...fixtureUser, deletedAt: Date.now(), state: "deleted" }
        return resultCreate({ user: fixtureUser })
      },
      loadUser: async () => {
        if (fixtureState() === "error") return error()
        return resultCreate({ user: fixtureUser })
      },
      updatePassword: async () => (fixtureState() === "error" ? error() : resultCreate({ changed: true as const })),
      updateProfile: async (input: UserProfileUpdateRequest) => {
        if (fixtureState() === "error") return error()
        fixtureUser = {
          ...fixtureUser,
          profile: {
            ...fixtureUser.profile,
            ...Object.fromEntries(Object.entries(input).filter((entry) => entry[1] !== null)),
          },
          updatedAt: Date.now(),
        }
        return resultCreate({ user: fixtureUser })
      },
    },
    initialStatus: fixtureState() === "loading" ? "loading" : undefined,
    kind: kind(),
  })
  createEffect(() => {
    const selectedState = fixtureState()
    if (selectedState === "loading") {
      page.status.set("loading")
      return
    }
    void page.load(true)
  })
  return {
    fixtureState,
    page,
  }
}
