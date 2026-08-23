import { useLocation } from "@solidjs/router"
import { createMemo } from "solid-js"
import { demoAdminMachineSecret } from "../../demo/demoAdminMachineSecret.js"
import { demoAdminMachineUsers } from "../../demo/demoAdminMachineUsers.js"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { demoFixtureStateLabel } from "../../demo/public/demoFixtureStateLabel.js"
import { machineAdminDemoAdapterCreate } from "./machineAdminDemoAdapterCreate.js"
import { machineAdminDemoIssuedSecretSeedSelect } from "./machineAdminDemoIssuedSecretSeedSelect.js"
import type { MachineAdminScreen } from "./machineAdminScreenSchema.js"
import { machineAdminScreenStateCreate } from "./machineAdminScreenStateCreate.js"
import { machineAdminSecretAcknowledgementStore } from "./machineAdminSecretAcknowledgementStore.js"

/** The fixed "now" the credential fixtures are authored against, so expiry is deterministic. */
const demoNow = 1_755_782_400_000

export function machineAdminDemoStateCreate(options: {
  readonly machineUserId: () => string | undefined
  readonly screen: () => MachineAdminScreen
}) {
  const location = useLocation()
  const scenario = () =>
    demoFixtureScenarioSelect(location.pathname, demoAdminScenarioGroups) ??
    demoAdminScenarioGroups.flatMap((group) => group.scenarios).find((item) => item.key === options.screen())
  // Keep URL-only changes (dialogs, search, and selections) from looking like a fixture change.
  // The page state must retain a newly issued secret until it is acknowledged.
  const fixtureState = createMemo(() => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"]))

  const selectedMachineUserId = () =>
    options.screen() === "machine-credentials"
      ? (new URLSearchParams(location.search).get("machineUserId") ?? options.machineUserId())
      : options.machineUserId()

  // The one-time state is reachable straight from a URL, so it seeds an already-issued
  // secret instead of requiring the operator to run a mutation first. Once acknowledged it
  // must not reappear on reload, so the acknowledgement is remembered for this session.
  const issuedSecretSeed = () => {
    if (fixtureState() !== "one-time") return undefined
    const seeded = machineAdminDemoIssuedSecretSeedSelect({
      machineUserId: selectedMachineUserId(),
      machineUsers: demoAdminMachineUsers,
      secret: demoAdminMachineSecret,
    })
    if (seeded === undefined) return undefined
    const marker = machineAdminSecretAcknowledgementStore.markerBuild(seeded.machineUserId, seeded.kind)
    return machineAdminSecretAcknowledgementStore.acknowledged(marker) ? undefined : seeded
  }

  const screenState = machineAdminScreenStateCreate({
    adapter: machineAdminDemoAdapterCreate(fixtureState),
    basePath: "/demo/admin",
    issuedSecretSeed,
    machineUserId: options.machineUserId,
    now: () => demoNow,
    onIssuedSecretAcknowledge: (issued) =>
      machineAdminSecretAcknowledgementStore.acknowledge(
        machineAdminSecretAcknowledgementStore.markerBuild(issued.machineUserId, issued.kind),
      ),
    reloadKey: fixtureState,
    screen: options.screen,
  })

  return {
    ...screenState,
    fixtureState,
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((state) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, state),
        label: demoFixtureStateLabel(state),
        selected: state === fixtureState(),
      })),
  }
}
