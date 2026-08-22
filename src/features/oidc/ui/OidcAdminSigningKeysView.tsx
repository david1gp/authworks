import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { OidcAdminNotice } from "./OidcAdminNotice.js"
import { OidcAdminPagination } from "./OidcAdminPagination.js"
import { OidcAdminStateBoundary } from "./OidcAdminStateBoundary.js"
import type { OidcAdminPageState } from "./oidcAdminPageStateCreate.js"

export function OidcAdminSigningKeysView(props: { readonly state: OidcAdminPageState }) {
  const state = props.state
  return (
    <section class="grid min-w-0 gap-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.oidc.keys.title")}</h1>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {messageTranslate("admin.oidc.keys.description")}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            disabled={state.pendingId() !== undefined}
            onClick={() => void state.signingKeyCreate()}
            variant="outline"
          >
            {messageTranslate("admin.oidc.keys.create")}
          </Button>
          <Button
            disabled={state.pendingId() !== undefined}
            onClick={() => void state.signingKeyRotate()}
            variant="filledBlue"
          >
            {messageTranslate("admin.oidc.keys.rotate")}
          </Button>
        </div>
      </div>

      <OidcAdminNotice notice={state.notice()} />
      <p class="rounded-lg border border-line bg-muted px-4 py-3 text-sm text-muted-foreground">
        {messageTranslate("admin.oidc.keys.privateNotice")}
      </p>

      <OidcAdminStateBoundary
        emptyDetail={messageTranslate("admin.oidc.keys.empty")}
        error={state.error()}
        onRetry={state.reload}
        status={state.status()}
      >
        <CardWrapper class="min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messageTranslate("admin.oidc.keys.keyId")}</TableHead>
                <TableHead>{messageTranslate("admin.oidc.keys.algorithm")}</TableHead>
                <TableHead>{messageTranslate("admin.oidc.status")}</TableHead>
                <TableHead>{messageTranslate("admin.oidc.created")}</TableHead>
                <TableHead>{messageTranslate("admin.oidc.keys.retiredAt")}</TableHead>
                <TableHead class="text-right">{messageTranslate("admin.oidc.keys.retire")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.signingKeys()}>
                {(key) => (
                  <TableRow>
                    <TableCell class="font-mono text-xs">{key.publicJwk.kid}</TableCell>
                    <TableCell>{key.algorithm}</TableCell>
                    <TableCell>
                      <Badge variant={key.status === "active" ? "filledGreen" : "filledYellow"}>{key.status}</Badge>
                    </TableCell>
                    <TableCell>{localeDateFormat(key.createdAt, { dateStyle: "medium" })}</TableCell>
                    <TableCell>
                      {key.retiredAt === null ? "—" : localeDateFormat(key.retiredAt, { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell class="text-right">
                      <Show when={key.status === "active"}>
                        <Button
                          disabled={state.pendingId() !== undefined}
                          onClick={() => void state.signingKeyRetire(key.id)}
                          variant="filledRed"
                        >
                          {messageTranslate("admin.oidc.keys.retire")}
                        </Button>
                      </Show>
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
          <OidcAdminPagination
            hasNext={state.hasNextPage()}
            hasPrevious={state.hasPreviousPage()}
            onNext={state.pageNext}
            onPrevious={state.pagePrevious}
          />
        </CardWrapper>
      </OidcAdminStateBoundary>
    </section>
  )
}
