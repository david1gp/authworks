import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { OrganizationAdminScreenView } from "./OrganizationAdminScreenView.js"
import { organizationAdminDemoStateCreate } from "./organizationAdminDemoStateCreate.js"
import type { OrganizationAdminScreen } from "./organizationAdminScreenSchema.js"

export function OrganizationAdminDemoAdapter(props: { readonly screen: OrganizationAdminScreen }) {
  const state = organizationAdminDemoStateCreate(() => props.screen)
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AuthenticatedPageHeader
        description={state.scenarioDescription()}
        eyebrow={messageTranslate("demo.fixture.preview")}
        meta={
          <>
            <span class="text-2xs font-semibold uppercase tracking-[0.12em]">
              {messageTranslate("demo.fixture.state")}
            </span>
            <DemoFixtureStateSelector options={state.stateOptions()} />
          </>
        }
        title={state.scenarioTitle()}
      />
      <OrganizationAdminScreenView state={state} />
    </div>
  )
}
