import { useLocation } from "@solidjs/router"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { demoConsentScenarioGroups } from "../../demo/demoConsentScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { demoFixtureStateLabel } from "../../demo/public/demoFixtureStateLabel.js"
import { oidcConsentDemoFixture } from "./oidcConsentDemoFixture.js"

export function oidcConsentDemoStateCreate() {
  const location = useLocation()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoConsentScenarioGroups)
  const selectedState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])
  const outcome = createSignalObject<"approved" | "declined" | undefined>(undefined)

  return {
    consentApprove: () => outcome.set("approved"),
    consentDecline: () => outcome.set("declined"),
    fixture: () => oidcConsentDemoFixture,
    outcome: outcome.get,
    selectedState,
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((fixtureState) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, fixtureState),
        label: demoFixtureStateLabel(fixtureState),
        selected: fixtureState === selectedState(),
      })),
  }
}
