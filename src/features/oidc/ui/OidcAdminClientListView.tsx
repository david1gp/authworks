import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { AuthenticatedToolbar } from "../../../ui/authenticated/AuthenticatedToolbar.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OidcClient } from "../public/oidcClientSchema.js"
import { OidcAdminClientFormFields } from "./OidcAdminClientFormFields.js"
import { OidcAdminNotice } from "./OidcAdminNotice.js"
import { OidcAdminSecretPanel } from "./OidcAdminSecretPanel.js"
import { OidcAdminStateBoundary } from "./OidcAdminStateBoundary.js"
import { OidcAdminUriList } from "./OidcAdminUriList.js"
import { oidcAdminClientStatusTone } from "./oidcAdminClientStatusTone.js"
import type { oidcAdminClientListViewStateCreate } from "./oidcAdminClientListViewStateCreate.js"

export function OidcAdminClientListView(props: {
  readonly state: ReturnType<typeof oidcAdminClientListViewStateCreate>
}) {
  const state = props.state
  const typeLabel = (client: OidcClient) =>
    client.clientType === "public"
      ? messageTranslate("admin.oidc.clients.typePublic")
      : messageTranslate("admin.oidc.clients.typeConfidential")
  const consentLabel = (client: OidcClient) => {
    if (client.trusted) return messageTranslate("admin.oidc.clients.trusted")
    return client.requireConsent
      ? messageTranslate("admin.oidc.clients.consentRequired")
      : messageTranslate("admin.oidc.clients.consentSkipped")
  }
  const clientOpenButton = (client: OidcClient) => (
    <button
      class="text-left font-medium text-accent hover:underline"
      onClick={() => state.clientOpen(client.id)}
      type="button"
    >
      {client.name}
    </button>
  )

  return (
    <section aria-label={messageTranslate("admin.oidc.clients.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <AuthenticatedToolbar
        actions={
          <AuthenticatedDialog
            description={messageTranslate("admin.oidc.clients.createDescription")}
            onOpenChange={state.createOpenSet}
            open={state.createOpen()}
            title={messageTranslate("admin.oidc.clients.create")}
            triggerLabel={messageTranslate("admin.oidc.clients.create")}
            variant="filledBlue"
          >
            <form class="grid gap-3" onSubmit={state.createSubmit}>
              <OidcAdminClientFormFields
                clientType={state.clientType}
                idPrefix="oidc-client"
                name={state.name}
                postLogoutRedirectUris={state.postLogoutRedirectUris}
                redirectUris={state.redirectUris}
                requireConsent={state.requireConsent}
                scopeToggle={state.scopeToggle}
                scopes={state.scopes}
                scopesSupported={state.scopesSupported}
                trusted={state.trusted}
              />
              <Show when={state.formError()}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>
              <Button disabled={state.page.pendingId() !== undefined} type="submit" variant="filledBlue">
                {messageTranslate("common.save")}
              </Button>
            </form>
          </AuthenticatedDialog>
        }
        label={messageTranslate("admin.oidc.clients.title")}
        summary={messageTranslate("admin.oidc.clients.description")}
      >
        <Label class="sr-only" for="oidc-client-search">
          {messageTranslate("admin.oidc.clients.search")}
        </Label>
        <Input
          class="max-w-xs"
          id="oidc-client-search"
          onInput={(event) => state.searchSet(event.currentTarget.value)}
          placeholder={messageTranslate("admin.oidc.clients.search")}
          value={state.search()}
        />
      </AuthenticatedToolbar>

      <OidcAdminNotice notice={state.page.notice()} />
      <Show when={state.page.issuedSecret()}>
        {(issued) => (
          <OidcAdminSecretPanel
            clientName={issued().clientName}
            kind={issued().kind}
            onAcknowledge={state.page.issuedSecretAcknowledge}
            secret={issued().secret}
          />
        )}
      </Show>

      <OidcAdminStateBoundary
        emptyDetail={messageTranslate("admin.oidc.clients.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <AuthenticatedSection>
          <AuthenticatedRecordList label={messageTranslate("admin.oidc.clients.title")}>
            <For each={state.filteredClients()}>
              {(client) => (
                <AuthenticatedRecordItem
                  fields={[
                    { label: messageTranslate("admin.oidc.clients.type"), value: typeLabel(client) },
                    { label: messageTranslate("admin.oidc.clients.consent"), value: consentLabel(client) },
                    {
                      label: messageTranslate("admin.oidc.clients.redirectUris"),
                      value: <OidcAdminUriList uris={client.redirectUris} wrap />,
                      wide: true,
                    },
                    {
                      label: messageTranslate("admin.oidc.updated"),
                      value: localeDateFormat(client.updatedAt, { dateStyle: "medium" }),
                    },
                  ]}
                  status={
                    <AuthenticatedStatus
                      label={messageTranslate(`admin.oidc.clients.statusValue.${client.status}`)}
                      tone={oidcAdminClientStatusTone(client.status)}
                    />
                  }
                  title={clientOpenButton(client)}
                />
              )}
            </For>
          </AuthenticatedRecordList>

          <Table
            aria-label={messageTranslate("admin.oidc.clients.title")}
            class={authenticatedTableClasses.tableWide}
            tabIndex={0}
          >
            <TableHeader class={authenticatedTableClasses.header}>
              <TableRow>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.oidc.clients.name")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.oidc.clients.type")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.oidc.clients.redirectUris")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.oidc.clients.consent")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.oidc.status")}</TableHead>
                <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.oidc.updated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.filteredClients()}>
                {(client) => (
                  <TableRow class={authenticatedTableClasses.row}>
                    <TableCell class={authenticatedTableClasses.cell}>{clientOpenButton(client)}</TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap`}>
                      {typeLabel(client)}
                    </TableCell>
                    {/* Long exact URIs stay on one line each and truncate, so rows never turn ragged. */}
                    <TableCell class={`${authenticatedTableClasses.cell} max-w-[26rem]`}>
                      <OidcAdminUriList uris={client.redirectUris} />
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap`}>
                      {consentLabel(client)}
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <AuthenticatedStatus
                        label={messageTranslate(`admin.oidc.clients.statusValue.${client.status}`)}
                        tone={oidcAdminClientStatusTone(client.status)}
                      />
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      {localeDateFormat(client.updatedAt, { dateStyle: "medium" })}
                    </TableCell>
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
