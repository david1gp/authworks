import { mdiContentCopy } from "@adaptive-ds/mdi/mdiContentCopy.js"
import { mdiOpenInNew } from "@adaptive-ds/mdi/mdiOpenInNew.js"
import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedButton as ButtonIcon } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

/**
 * One read-only protocol document: a summary body plus the raw JSON behind a disclosure. It offers
 * copying and, when the endpoint is reachable from this origin, opening — never editing.
 */
export function OidcAdminDocumentSection(props: {
  readonly children: JSX.Element
  readonly copied: boolean
  readonly description: string
  readonly json: string
  readonly onCopy: () => void
  readonly openHref?: string
  readonly title: string
}) {
  return (
    <AuthenticatedSection
      actions={
        <>
          <ButtonIcon size="sm" icon={mdiContentCopy} onClick={props.onCopy} variant="outline">
            {messageTranslate("admin.oidc.documents.copy")}
          </ButtonIcon>
          {/* A fixture endpoint resolves nowhere, so no broken link is offered. */}
          <Show when={props.openHref}>
            {(href) => (
              <a
                class="inline-flex h-8 items-center gap-2 rounded-control border border-line-strong/70 bg-surface px-3 text-[0.8125rem] font-medium hover:bg-surface-hover"
                href={href()}
                rel="noreferrer"
                target="_blank"
              >
                <Icon class="size-4" path={mdiOpenInNew} />
                {messageTranslate("admin.oidc.documents.open")}
              </a>
            )}
          </Show>
          <Show when={props.copied}>
            <span class="text-xs font-medium text-success" role="status">
              {messageTranslate("admin.oidc.documents.copied")}
            </span>
          </Show>
        </>
      }
      description={props.description}
      title={props.title}
    >
      <div class="grid min-w-0 gap-4 px-5 py-4">
        {props.children}
        <details class="min-w-0 rounded-control border border-line-subtle">
          <summary class="cursor-pointer px-2 py-1.5 text-xs font-medium">
            {messageTranslate("admin.oidc.documents.showRaw")}
          </summary>
          <pre class="max-h-96 w-full min-w-0 overflow-auto whitespace-pre border-t border-line-subtle bg-muted px-4 py-3 font-mono text-xs leading-5">
            {props.json}
          </pre>
        </details>
      </div>
    </AuthenticatedSection>
  )
}
