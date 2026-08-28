import { For, Show } from "solid-js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { OidcAdminDocumentSection } from "./OidcAdminDocumentSection.js"
import { OidcAdminStateBoundary } from "./OidcAdminStateBoundary.js"
import type { OidcAdminPageState } from "./oidcAdminPageStateCreate.js"
import { oidcAdminProtocolDocumentsViewStateCreate } from "./oidcAdminProtocolDocumentsViewStateCreate.js"

/**
 * Discovery and JWKS are protocol-owned documents. This page is explicitly read-only:
 * it offers viewing and copying only, and exposes no edit or delete control.
 */
export function OidcAdminProtocolDocumentsView(props: { readonly state: OidcAdminPageState }) {
  const state = oidcAdminProtocolDocumentsViewStateCreate({ page: props.state })
  return (
    <section aria-label={messageTranslate("admin.oidc.documents.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      {/* The page offers no mutation at all, so its intent is stated once above the documents. */}
      <p class="grid gap-0.5 rounded-panel border border-line bg-muted px-3 py-2 text-xs" data-read-only-notice>
        <span class="font-medium">{messageTranslate("admin.oidc.documents.description")}</span>
        <span class="text-muted-foreground">{messageTranslate("admin.oidc.documents.readOnly")}</span>
      </p>

      <OidcAdminStateBoundary
        emptyDetail={messageTranslate("admin.oidc.documents.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
          <Show when={state.page.discovery()}>
            <OidcAdminDocumentSection
              copied={state.copied("discovery")}
              description={messageTranslate("admin.oidc.documents.discoveryDescription")}
              json={state.discoveryJson()}
              onCopy={state.discoveryCopy}
              openHref={state.discoveryHref()}
              title={messageTranslate("admin.oidc.documents.discoveryTitle")}
            >
              {/* Endpoint URLs are long, so they read as dense truncating identifier fields. */}
              <AuthenticatedFieldList
                columns={3}
                fields={state.discoveryEndpoints().map((endpoint) => ({
                  identifier: true,
                  label: endpoint.label,
                  value: endpoint.value,
                }))}
              />
            </OidcAdminDocumentSection>
          </Show>

          <Show when={state.page.jwks()}>
            {(jwks) => (
              <OidcAdminDocumentSection
                copied={state.copied("jwks")}
                description={messageTranslate("admin.oidc.documents.jwksDescription")}
                json={state.jwksJson()}
                onCopy={state.jwksCopy}
                openHref={state.jwksHref()}
                title={messageTranslate("admin.oidc.documents.jwksTitle")}
              >
                <ul aria-label={messageTranslate("admin.oidc.keys.keyId")} class="grid min-w-0 gap-1">
                  <For each={jwks().keys}>
                    {(key) => (
                      <li class="flex min-w-0 items-center justify-between gap-3 rounded-control border border-line-subtle px-2 py-1">
                        <span class="min-w-0 truncate font-mono text-xs" title={key.kid}>
                          {key.kid}
                        </span>
                        <span class="shrink-0 text-2xs font-medium text-muted-foreground">{key.alg}</span>
                      </li>
                    )}
                  </For>
                </ul>
              </OidcAdminDocumentSection>
            )}
          </Show>
        </div>
      </OidcAdminStateBoundary>
    </section>
  )
}
