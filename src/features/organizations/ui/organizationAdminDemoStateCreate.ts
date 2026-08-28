import { useLocation, useParams } from "@solidjs/router"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoAdminScenarioMessageKeyGet } from "../../demo/public/demoAdminScenarioMessageKeyGet.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { demoFixtureStateLabel } from "../../demo/public/demoFixtureStateLabel.js"
import { organizationAdminDemoAdapterCreate } from "./organizationAdminDemoAdapterCreate.js"
import { organizationAdminInvitationAcknowledgementStore } from "./organizationAdminInvitationAcknowledgementStore.js"
import { organizationAdminPageStateCreate } from "./organizationAdminPageStateCreate.js"
import type { OrganizationAdminScreen } from "./organizationAdminScreenSchema.js"
import { organizationAdminScreenStateCreate } from "./organizationAdminScreenStateCreate.js"

const demoOrganizationId = "01900000-0000-7000-8000-000000000011"

/** Binds the organization administration screens to network-free, URL-selectable demo fixtures. */
export function organizationAdminDemoStateCreate(screen: () => OrganizationAdminScreen) {
  const location = useLocation()
  const params = useParams<{ organizationId?: string }>()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAdminScenarioGroups)
  const fixtureState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])
  const organizationId = () =>
    new URLSearchParams(location.search).get("scope") === "realm" ? "" : (params.organizationId ?? demoOrganizationId)
  const adapter = organizationAdminDemoAdapterCreate(fixtureState)
  const initialInvitationToken = () => {
    if (fixtureState() !== "one-time") return undefined
    const marker = organizationAdminInvitationAcknowledgementStore.markerBuild(organizationId(), fixtureState())
    return organizationAdminInvitationAcknowledgementStore.acknowledged(marker)
      ? undefined
      : "demo-invitation-token-0f9c31a7e5b24d68"
  }
  // The demo shows the same in-app confirmation as production, so destructive flows stay faithful.
  const confirmState = confirmStateCreate()
  const page = organizationAdminPageStateCreate({
    adapter,
    confirm: confirmState.confirm,
    initialInvitationToken,
    onInvitationTokenDismiss: () => {
      if (fixtureState() === "one-time") {
        organizationAdminInvitationAcknowledgementStore.acknowledge(
          organizationAdminInvitationAcknowledgementStore.markerBuild(organizationId(), fixtureState()),
        )
      }
    },
    organizationId,
    reloadKey: fixtureState,
    screen,
  })
  const screenState = organizationAdminScreenStateCreate({ basePath: "/demo/admin", confirmState, page })

  const scenarioMessage = (kind: "description" | "title") => {
    const key = scenario()?.key
    return key === undefined ? undefined : demoAdminScenarioMessageKeyGet(key, kind)
  }

  return {
    ...screenState,
    scenarioDescription: () => {
      const key = scenarioMessage("description")
      return key === undefined ? messageTranslate("demo.admin.eyebrow") : messageTranslate(key)
    },
    scenarioTitle: () => {
      const key = scenarioMessage("title")
      return key === undefined ? messageTranslate("admin.organizations.detailTitle") : messageTranslate(key)
    },
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((state) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, state),
        label: demoFixtureStateLabel(state),
        selected: state === fixtureState(),
      })),
  }
}
