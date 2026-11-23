import { useLocation } from "@solidjs/router"
import { type Accessor, createEffect, untrack } from "solid-js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { accountDemoAdapterCreate } from "./accountDemoAdapterCreate.js"
import { accountPageStateCreate } from "./accountPageStateCreate.js"

export function accountDemoAdapterStateCreate(
  kind: Accessor<"delete" | "email" | "overview" | "password" | "profile">,
  options: {
    readonly onPasswordChanged?: () => void
  } = {},
) {
  const location = useLocation()
  const fixtureState = () => demoFixtureStateSelect(location.search, ["success", "loading", "error"])
  const page = accountPageStateCreate({
    adapter: accountDemoAdapterCreate(fixtureState),
    initialStatus: untrack(fixtureState) === "loading" ? "loading" : undefined,
    kind: kind(),
    onPasswordChanged: options.onPasswordChanged,
  })
  createEffect(fixtureState, (selectedState) =>
    untrack(() => {
      if (selectedState === "loading") {
        page.status.set("loading")
        return
      }
      void page.load(true)
    }),
  )
  return {
    fixtureState,
    page,
  }
}
