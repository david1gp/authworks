import { A } from "@solidjs/router"
import { For, Match, Switch } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionFocusShell } from "../../../ui/production/ProductionFocusShell.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import type { oidcConsentDemoStateCreate } from "./oidcConsentDemoStateCreate.js"

export function OidcConsentDemoView(props: { readonly state: ReturnType<typeof oidcConsentDemoStateCreate> }) {
  return (
    <ProductionFocusShell title={messageTranslate("shell.nav.applicationConsent")}>
      <div class="mb-4 flex justify-center">
        <DemoFixtureStateSelector options={props.state.stateOptions()} />
      </div>
      <Switch>
        <Match when={props.state.selectedState() === "loading"}>
          <ProductionStatePanel state="loading" />
        </Match>
        <Match when={props.state.selectedState() === "error"}>
          <ProductionStatePanel detail={messageTranslate("demo.consent.error")} state="error" />
        </Match>
        <Match when={props.state.selectedState() === "expired"}>
          <ProductionStatePanel
            detail={messageTranslate("demo.consent.expired")}
            state="inaccessible"
            title={messageTranslate("demo.consent.expiredTitle")}
          />
        </Match>
        <Match when={props.state.outcome() === "approved"}>
          <AuthenticatedPageBody>
            <AuthenticatedSection padded>
              <div class="grid gap-3">
                <p class="text-sm">{messageTranslate("demo.consent.approved")}</p>
                <A class="text-sm font-medium text-accent hover:underline" href="/demo">
                  {messageTranslate("common.back")}
                </A>
              </div>
            </AuthenticatedSection>
          </AuthenticatedPageBody>
        </Match>
        <Match when={props.state.outcome() === "declined"}>
          <AuthenticatedPageBody>
            <AuthenticatedSection padded>
              <div class="grid gap-3">
                <p class="text-sm">{messageTranslate("demo.consent.declined")}</p>
                <A class="text-sm font-medium text-accent hover:underline" href="/demo">
                  {messageTranslate("common.back")}
                </A>
              </div>
            </AuthenticatedSection>
          </AuthenticatedPageBody>
        </Match>
        <Match when={true}>
          <AuthenticatedPageBody>
            <AuthenticatedSection
              description={messageTranslate("demo.consent.requestDescription", {
                application: props.state.fixture().applicationName,
              })}
              padded
              title={props.state.fixture().applicationName}
            >
              <div class="grid gap-4">
                <div class="grid gap-1">
                  <h2 class="text-sm font-semibold">{messageTranslate("demo.consent.scopeTitle")}</h2>
                  <ul class="flex flex-wrap gap-1.5" aria-label={messageTranslate("demo.consent.scopeTitle")}>
                    <For each={props.state.fixture().scopes}>
                      {(scope) => <li class="rounded-control bg-muted px-2 py-1 font-mono text-xs">{scope}</li>}
                    </For>
                  </ul>
                </div>
                <dl class="grid gap-2 text-xs">
                  <div>
                    <dt class="font-semibold text-muted-foreground">{messageTranslate("demo.consent.clientId")}</dt>
                    <dd class="font-mono">{props.state.fixture().clientId}</dd>
                  </div>
                  <div>
                    <dt class="font-semibold text-muted-foreground">{messageTranslate("demo.consent.redirectUri")}</dt>
                    <dd class="break-all font-mono">{props.state.fixture().redirectUri}</dd>
                  </div>
                </dl>
                <p class="text-xs text-muted-foreground">
                  {messageTranslate("demo.consent.redirectDescription", {
                    redirectUri: props.state.fixture().redirectUri,
                  })}
                </p>
                <div class="flex flex-wrap gap-2">
                  <Button onClick={props.state.consentDecline} variant="outline">
                    {messageTranslate("common.decline")}
                  </Button>
                  <Button onClick={props.state.consentApprove} variant="filledBlue">
                    {messageTranslate("common.continue")}
                  </Button>
                </div>
              </div>
            </AuthenticatedSection>
          </AuthenticatedPageBody>
        </Match>
      </Switch>
    </ProductionFocusShell>
  )
}
