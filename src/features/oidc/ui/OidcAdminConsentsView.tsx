import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { For } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSelect } from "../../../ui/authenticated/AuthenticatedSelect.js"
import { AuthenticatedToolbar } from "../../../ui/authenticated/AuthenticatedToolbar.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OidcConsent } from "../public/oidcConsentSchema.js"
import { OidcAdminNotice } from "./OidcAdminNotice.js"
import { OidcAdminScopeList } from "./OidcAdminScopeList.js"
import { OidcAdminStateBoundary } from "./OidcAdminStateBoundary.js"
import type { oidcAdminConsentsViewStateCreate } from "./oidcAdminConsentsViewStateCreate.js"

export function OidcAdminConsentsView(props: { readonly state: ReturnType<typeof oidcAdminConsentsViewStateCreate> }) {
  const state = props.state
  const revokeButton = (consent: OidcConsent) => (
    <AuthenticatedButton
      aria-label={messageTranslate("common.revoke")}
      title={messageTranslate("common.revoke")}
      disabled={state.page.pendingId() !== undefined}
      icon={mdiCancel}
      onClick={() => state.consentRevoke(consent.clientId)}
      variant="outline"
    />
  )

  return (
    <section aria-label={messageTranslate("admin.oidc.consents.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <header class="flex items-baseline gap-3">
        <h1 class="text-lg font-semibold">{messageTranslate("admin.oidc.consents.title")}</h1>
        <span class="text-xs text-muted-foreground">
          {state.page.consents().length} {messageTranslate("admin.redesign.onThisPage")}
        </span>
      </header>
      <AuthenticatedToolbar label={messageTranslate("admin.oidc.consents.title")}>
        <Label class="text-xs font-medium text-muted-foreground" for="oidc-consent-user-search">
          {messageTranslate("admin.oidc.consents.searchUsers")}
        </Label>
        <div class="w-full sm:max-w-xs">
          <AuthenticatedInput
            id="oidc-consent-user-search"
            onInput={(event) => state.userSearchSet(event.currentTarget.value)}
            placeholder={messageTranslate("admin.oidc.consents.searchUsers")}
            value={state.userSearch()}
          />
        </div>
        <Label class="text-xs font-medium text-muted-foreground" for="oidc-consent-user">
          {messageTranslate("admin.oidc.consents.user")}
        </Label>
        <div class="w-full sm:max-w-xs">
          <AuthenticatedSelect
            getOptions={() => state.page.users().map((user) => user.id)}
            id="oidc-consent-user"
            valueSignal={state.userIdSignal}
            valueText={(userId) => state.page.userLabel(userId)}
          />
          <AuthenticatedPagination
            nextAvailable={state.userHasNextPage()}
            onNext={state.userPageNext}
            onPrevious={state.userPagePrevious}
            previousAvailable={state.userHasPreviousPage()}
          />
        </div>
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
                      value: <AuthenticatedRelativeTime value={consent.createdAt} />,
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
                      <AuthenticatedRelativeTime value={consent.createdAt} />
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
