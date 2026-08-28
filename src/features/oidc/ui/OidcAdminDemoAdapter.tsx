import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { OidcAdminScreenView } from "./OidcAdminScreenView.js"
import { oidcAdminDemoStateCreate } from "./oidcAdminDemoStateCreate.js"
import type { OidcAdminScreen } from "./oidcAdminScreenSchema.js"

export function OidcAdminDemoAdapter(props: { readonly clientId?: string; readonly screen: OidcAdminScreen }) {
  const state = oidcAdminDemoStateCreate({
    clientId: () => props.clientId,
    screen: () => props.screen,
  })
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
      <OidcAdminScreenView state={state} />
    </div>
  )
}
