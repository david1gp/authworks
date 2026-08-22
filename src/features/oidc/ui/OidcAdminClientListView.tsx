import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CorvuDialog } from "#ui/interactive/dialog/CorvuDialog.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { OidcAdminNotice } from "./OidcAdminNotice.js"
import { OidcAdminPagination } from "./OidcAdminPagination.js"
import { OidcAdminSecretPanel } from "./OidcAdminSecretPanel.js"
import { OidcAdminStateBoundary } from "./OidcAdminStateBoundary.js"
import type { oidcAdminClientListViewStateCreate } from "./oidcAdminClientListViewStateCreate.js"
import { oidcClientStatusBadgeVariant } from "./oidcClientStatusBadgeVariant.js"

export function OidcAdminClientListView(props: {
  readonly state: ReturnType<typeof oidcAdminClientListViewStateCreate>
}) {
  const state = props.state
  return (
    <section class="grid min-w-0 gap-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.oidc.clients.title")}</h2>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {messageTranslate("admin.oidc.clients.description")}
          </p>
        </div>
        <CorvuDialog
          buttonChildren={messageTranslate("admin.oidc.clients.create")}
          description={messageTranslate("admin.oidc.clients.createDescription")}
          onOpenChange={state.createOpenSet}
          open={state.createOpen()}
          title={messageTranslate("admin.oidc.clients.create")}
          variant="filledBlue"
        >
          <form class="grid gap-4" onSubmit={state.createSubmit}>
            <div class="grid gap-2">
              <Label for="oidc-client-name">{messageTranslate("admin.oidc.clients.name")}</Label>
              <Input
                id="oidc-client-name"
                onInput={(event) => state.name.set(event.currentTarget.value)}
                value={state.name.get()}
              />
            </div>
            <div class="grid gap-2">
              <Label for="oidc-client-type">{messageTranslate("admin.oidc.clients.type")}</Label>
              <SelectSingleNative
                getOptions={() => ["confidential", "public"]}
                id="oidc-client-type"
                valueSignal={state.clientType}
                valueText={(type) =>
                  type === "public"
                    ? messageTranslate("admin.oidc.clients.typePublic")
                    : messageTranslate("admin.oidc.clients.typeConfidential")
                }
              />
              <p class="text-xs text-muted-foreground">{messageTranslate("admin.oidc.clients.typeHint")}</p>
            </div>
            <div class="grid gap-2">
              <Label for="oidc-client-redirects">{messageTranslate("admin.oidc.clients.redirectUris")}</Label>
              <textarea
                class="min-h-24 w-full rounded-lg border border-line bg-surface p-2.5 font-mono text-sm"
                id="oidc-client-redirects"
                onInput={(event) => state.redirectUris.set(event.currentTarget.value)}
                value={state.redirectUris.get()}
              />
              <p class="text-xs text-muted-foreground">{messageTranslate("admin.oidc.clients.exactMatchHint")}</p>
            </div>
            <div class="grid gap-2">
              <Label for="oidc-client-post-logout">{messageTranslate("admin.oidc.clients.postLogoutUris")}</Label>
              <textarea
                class="min-h-16 w-full rounded-lg border border-line bg-surface p-2.5 font-mono text-sm"
                id="oidc-client-post-logout"
                onInput={(event) => state.postLogoutRedirectUris.set(event.currentTarget.value)}
                value={state.postLogoutRedirectUris.get()}
              />
            </div>
            <fieldset class="grid gap-2">
              <legend class="text-sm font-medium">{messageTranslate("admin.oidc.clients.scopes")}</legend>
              <For each={state.scopesSupported}>
                {(scope) => (
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      checked={state.scopes().includes(scope)}
                      onChange={() => state.scopeToggle(scope)}
                      type="checkbox"
                    />
                    <code class="text-xs">{scope}</code>
                  </label>
                )}
              </For>
            </fieldset>
            <label class="flex items-center gap-2 text-sm">
              <input
                checked={state.requireConsent.get()}
                onChange={(event) => state.requireConsent.set(event.currentTarget.checked)}
                type="checkbox"
              />
              <span>{messageTranslate("admin.oidc.clients.requireConsent")}</span>
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                checked={state.trusted.get()}
                onChange={(event) => state.trusted.set(event.currentTarget.checked)}
                type="checkbox"
              />
              <span>{messageTranslate("admin.oidc.clients.trusted")}</span>
            </label>
            <p class="text-xs text-muted-foreground">{messageTranslate("admin.oidc.clients.trustedHint")}</p>
            <Show when={state.formError()}>
              {(message) => (
                <p class="text-sm text-danger" role="alert">
                  {message()}
                </p>
              )}
            </Show>
            <Button disabled={state.page.pendingId() !== undefined} type="submit" variant="filledBlue">
              {messageTranslate("common.save")}
            </Button>
          </form>
        </CorvuDialog>
      </div>

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
        <CardWrapper class="min-w-0">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Label class="sr-only" for="oidc-client-search">
              {messageTranslate("admin.oidc.clients.search")}
            </Label>
            <Input
              class="max-w-sm"
              id="oidc-client-search"
              onInput={(event) => state.searchSet(event.currentTarget.value)}
              placeholder={messageTranslate("admin.oidc.clients.search")}
              value={state.search()}
            />
          </div>
          <Table aria-label={messageTranslate("admin.oidc.clients.title")} tabIndex={0}>
            <TableHeader>
              <TableRow>
                <TableHead>{messageTranslate("admin.oidc.clients.name")}</TableHead>
                <TableHead>{messageTranslate("admin.oidc.clients.type")}</TableHead>
                <TableHead>{messageTranslate("admin.oidc.clients.redirectUris")}</TableHead>
                <TableHead>{messageTranslate("admin.oidc.clients.consent")}</TableHead>
                <TableHead>{messageTranslate("admin.oidc.status")}</TableHead>
                <TableHead>{messageTranslate("admin.oidc.updated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.filteredClients()}>
                {(client) => (
                  <TableRow class="cursor-pointer" onClick={() => state.clientOpen(client.id)}>
                    <TableCell class="font-medium">{client.name}</TableCell>
                    <TableCell>
                      {client.clientType === "public"
                        ? messageTranslate("admin.oidc.clients.typePublic")
                        : messageTranslate("admin.oidc.clients.typeConfidential")}
                    </TableCell>
                    <TableCell class="min-w-64 whitespace-normal break-all font-mono text-xs">
                      {client.redirectUris.join(", ")}
                    </TableCell>
                    <TableCell>
                      <Show
                        when={client.trusted}
                        fallback={
                          client.requireConsent
                            ? messageTranslate("admin.oidc.clients.consentRequired")
                            : messageTranslate("admin.oidc.clients.consentSkipped")
                        }
                      >
                        <Badge variant="filledBlue">{messageTranslate("admin.oidc.clients.trusted")}</Badge>
                      </Show>
                    </TableCell>
                    <TableCell>
                      <Badge variant={oidcClientStatusBadgeVariant(client.status)}>{client.status}</Badge>
                    </TableCell>
                    <TableCell>{localeDateFormat(client.updatedAt, { dateStyle: "medium" })}</TableCell>
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
