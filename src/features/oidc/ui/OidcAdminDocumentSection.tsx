import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
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
          <Button onClick={props.onCopy} size="sm" variant="outline">
            {messageTranslate("admin.oidc.documents.copy")}
          </Button>
          {/* A fixture endpoint resolves nowhere, so no broken link is offered. */}
          <Show when={props.openHref}>
            {(href) => (
              <a
                class="inline-flex h-7 items-center rounded-control border border-line px-2 text-xs font-medium hover:bg-surface-hover"
                href={href()}
                rel="noreferrer"
                target="_blank"
              >
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
      <div class="grid min-w-0 gap-2.5 px-3 py-2.5">
        {props.children}
        <details class="min-w-0 rounded-control border border-line-subtle">
          <summary class="cursor-pointer px-2 py-1.5 text-xs font-medium">
            {messageTranslate("admin.oidc.documents.showRaw")}
          </summary>
          <pre class="max-h-96 w-full overflow-auto whitespace-pre border-t border-line-subtle bg-muted px-2 py-1.5 font-mono text-2xs leading-4">
            {props.json}
          </pre>
        </details>
      </div>
    </AuthenticatedSection>
  )
}
