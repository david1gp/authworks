import { For } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { OidcAdminNotice } from "./OidcAdminNotice.js"
import { OidcAdminPagination } from "./OidcAdminPagination.js"
import { OidcAdminStateBoundary } from "./OidcAdminStateBoundary.js"
import type { oidcAdminConsentsViewStateCreate } from "./oidcAdminConsentsViewStateCreate.js"

export function OidcAdminConsentsView(props: { readonly state: ReturnType<typeof oidcAdminConsentsViewStateCreate> }) {
  const state = props.state
  return (
    <section class="grid min-w-0 gap-6">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.oidc.consents.title")}</h1>
        <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {messageTranslate("admin.oidc.consents.description")}
        </p>
      </div>

      <OidcAdminNotice notice={state.page.notice()} />

      <CardWrapper>
        <div class="grid max-w-md gap-2">
          <Label for="oidc-consent-user">{messageTranslate("admin.oidc.consents.user")}</Label>
          <SelectSingleNative
            getOptions={() => state.page.users().map((user) => user.id)}
            id="oidc-consent-user"
            valueSignal={state.userIdSignal}
            valueText={(userId) => state.page.userLabel(userId)}
          />
        </div>
      </CardWrapper>

      <OidcAdminStateBoundary
        emptyDetail={messageTranslate("admin.oidc.consents.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <CardWrapper class="min-w-0">
          <Table aria-label={messageTranslate("admin.oidc.consents.title")} tabIndex={0}>
            <TableHeader>
              <TableRow>
                <TableHead>{messageTranslate("admin.oidc.consents.client")}</TableHead>
                <TableHead>{messageTranslate("admin.oidc.clients.scopes")}</TableHead>
                <TableHead>{messageTranslate("admin.oidc.consents.granted")}</TableHead>
                <TableHead class="text-right">{messageTranslate("common.revoke")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.page.consents()}>
                {(consent) => (
                  <TableRow>
                    <TableCell class="font-medium">{state.page.clientName(consent.clientId)}</TableCell>
                    <TableCell class="font-mono text-xs">{consent.scope.join(", ")}</TableCell>
                    <TableCell>{localeDateFormat(consent.createdAt, { dateStyle: "medium" })}</TableCell>
                    <TableCell class="text-right">
                      <Button
                        disabled={state.page.pendingId() !== undefined}
                        onClick={() => state.consentRevoke(consent.clientId)}
                        variant="filledRed"
                      >
                        {messageTranslate("common.revoke")}
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
          <OidcAdminPagination
            hasNext={state.page.hasNextPage()}
            hasPrevious={state.page.hasPreviousPage()}
            onNext={state.page.pageNext}
            onPrevious={state.page.pagePrevious}
          />
        </CardWrapper>
      </OidcAdminStateBoundary>
    </section>
  )
}
