import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { LinkTextExternal } from "#ui/interactive/link/LinkText.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import type { OrganizationDiscoveryResponse } from "../../organizations/public/organizationDiscoveryResponseSchema.js"
import { BrandHeader } from "./BrandHeader.js"
import { loginFrameStateCreate } from "./loginFrameStateCreate.js"

type LoginFrameProps = {
  bootstrap: Extract<OrganizationDiscoveryResponse, { found: true }>
  children: JSX.Element
}

export function LoginFrame(props: LoginFrameProps) {
  const state = loginFrameStateCreate(() => props.bootstrap)
  return (
    <PageWrapper class="min-h-dvh" innerClass="relative flex min-h-dvh items-center justify-center py-10">
      <div class="absolute right-4 top-4">
        <ThemeButton />
      </div>
      <div class="w-full max-w-lg">
        <CardWrapper
          class="p-6 sm:p-10"
          style={{ "--login-primary": state.theme().primaryColor, "--login-background": state.theme().backgroundColor }}
        >
          <BrandHeader name={state.bootstrap().organization.name} logoUrl={state.theme().logoUrl} />
          {props.children}
        </CardWrapper>
        <Show when={state.legal()?.termsUrl || state.legal()?.privacyUrl}>
          <p class="mt-5 text-center text-sm text-muted-foreground">
            By continuing, you acknowledge the{" "}
            <Show when={state.legal()?.termsUrl}>
              {(url) => (
                <LinkTextExternal href={url()} target="_blank" rel="noreferrer">
                  Terms
                </LinkTextExternal>
              )}
            </Show>
            <Show when={state.legal()?.termsUrl && state.legal()?.privacyUrl}> and </Show>
            <Show when={state.legal()?.privacyUrl}>
              {(url) => (
                <LinkTextExternal href={url()} target="_blank" rel="noreferrer">
                  Privacy
                </LinkTextExternal>
              )}
            </Show>
            .
          </p>
        </Show>
      </div>
    </PageWrapper>
  )
}
