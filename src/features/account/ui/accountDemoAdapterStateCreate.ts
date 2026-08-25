import { useLocation } from "@solidjs/router"
import { type Accessor, createEffect } from "solid-js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { accountDemoAdapterCreate } from "./accountDemoAdapterCreate.js"
import { accountPageStateCreate } from "./accountPageStateCreate.js"

export function accountDemoAdapterStateCreate(
  kind: Accessor<"delete" | "email" | "overview" | "password" | "profile">,
) {
  const location = useLocation()
  const fixtureState = () => demoFixtureStateSelect(location.search, ["success", "loading", "error"])
  const page = accountPageStateCreate({
    adapter: accountDemoAdapterCreate(fixtureState),
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
