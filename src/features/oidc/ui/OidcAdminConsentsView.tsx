import { For } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedToolbar } from "../../../ui/authenticated/AuthenticatedToolbar.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OidcConsent } from "../public/oidcConsentSchema.js"
import { OidcAdminNotice } from "./OidcAdminNotice.js"
import { OidcAdminScopeList } from "./OidcAdminScopeList.js"
import { OidcAdminStateBoundary } from "./OidcAdminStateBoundary.js"
import type { oidcAdminConsentsViewStateCreate } from "./oidcAdminConsentsViewStateCreate.js"

export function OidcAdminConsentsView(props: { readonly state: ReturnType<typeof oidcAdminConsentsViewStateCreate> }) {
  const state = props.state
  const revokeButton = (consent: OidcConsent) => (
    <Button
      disabled={state.page.pendingId() !== undefined}
      onClick={() => state.consentRevoke(consent.clientId)}
      size="sm"
      variant="outline"
    >
      {messageTranslate("common.revoke")}
    </Button>
  )

  return (
    <section aria-label={messageTranslate("admin.oidc.consents.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <AuthenticatedToolbar
        label={messageTranslate("admin.oidc.consents.title")}
        summary={messageTranslate("admin.oidc.consents.description")}
      >
        <Label class="text-2xs font-semibold tracking-[0.12em] uppercase text-muted-foreground" for="oidc-consent-user">
          {messageTranslate("admin.oidc.consents.user")}
        </Label>
        <SelectSingleNative
          class="max-w-xs"
          getOptions={() => state.page.users().map((user) => user.id)}
          id="oidc-consent-user"
          valueSignal={state.userIdSignal}
          valueText={(userId) => state.page.userLabel(userId)}
        />
      </AuthenticatedToolbar>

      <OidcAdminNotice notice={state.page.notice()} />

      <OidcAdminStateBoundary
        emptyDetail={messageTranslate("admin.oidc.consents.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <AuthenticatedSection>
          <AuthenticatedRecordList label={messageTranslate("admin.oidc.consents.title")}>
            <For each={state.page.consents()}>
              {(consent) => (
                <AuthenticatedRecordItem
                  actions={revokeButton(consent)}
                  fields={[
                    {
                      label: messageTranslate("admin.oidc.clients.scopes"),
                      value: <OidcAdminScopeList scopes={consent.scope} />,
                      wide: true,
                    },
                    {
                      label: messageTranslate("admin.oidc.consents.granted"),
                      value: localeDateFormat(consent.createdAt, { dateStyle: "medium" }),
                    },
                  ]}
                  title={state.page.clientName(consent.clientId)}
                />
              )}
            </For>
          </AuthenticatedRecordList>

          <Table
            aria-label={messageTranslate("admin.oidc.consents.title")}
            class={authenticatedTableClasses.tableWide}
            tabIndex={0}
          >
            <TableHeader class={authenticatedTableClasses.header}>
              <TableRow>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.oidc.consents.client")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.oidc.clients.scopes")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.oidc.consents.granted")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  <span class="sr-only">{messageTranslate("common.revoke")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.page.consents()}>
                {(consent) => (
                  <TableRow class={authenticatedTableClasses.row}>
                    <TableCell class={`${authenticatedTableClasses.cell} font-medium`}>
                      {state.page.clientName(consent.clientId)}
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <OidcAdminScopeList scopes={consent.scope} />
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      {localeDateFormat(consent.createdAt, { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.action}>{revokeButton(consent)}</TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>

          <AuthenticatedPagination
            nextAvailable={state.page.hasNextPage()}
            onNext={state.page.pageNext}
            onPrevious={state.page.pagePrevious}
            previousAvailable={state.page.hasPreviousPage()}
          />
        </AuthenticatedSection>
      </OidcAdminStateBoundary>
    </section>
  )
}
