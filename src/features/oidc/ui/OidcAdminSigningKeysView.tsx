import { mdiAutorenew } from "@adaptive-ds/mdi/mdiAutorenew.js"
import { mdiKeyRemove } from "@adaptive-ds/mdi/mdiKeyRemove.js"
import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { For, Show } from "solid-js"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedCopyableId } from "../../../ui/authenticated/AuthenticatedCopyableId.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OidcSigningKey } from "../public/oidcSigningKeySchema.js"
import { OidcAdminNotice } from "./OidcAdminNotice.js"
import { OidcAdminStateBoundary } from "./OidcAdminStateBoundary.js"
import type { OidcAdminPageState } from "./oidcAdminPageStateCreate.js"
import { oidcAdminSigningKeyStatusTone } from "./oidcAdminSigningKeyStatusTone.js"

export function OidcAdminSigningKeysView(props: { readonly state: OidcAdminPageState }) {
  const state = props.state
  const retiredAt = (key: OidcSigningKey) => <AuthenticatedRelativeTime fallback="—" value={key.retiredAt} />
  const retireButton = (key: OidcSigningKey) => (
    <Show when={key.status === "active"}>
      <AuthenticatedButton
        aria-label={messageTranslate("admin.oidc.keys.retire")}
        title={messageTranslate("admin.oidc.keys.retire")}
        disabled={state.pendingId() !== undefined}
        icon={mdiKeyRemove}
        onClick={() => void state.signingKeyRetire(key.id)}
        variant="outline"
      />
    </Show>
  )

  return (
    <section aria-label={messageTranslate("admin.oidc.keys.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <header class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-baseline gap-3">
          <h1 class="text-lg font-semibold">{messageTranslate("admin.oidc.keys.title")}</h1>
          <span class="text-xs text-muted-foreground">
            {state.signingKeys().length} {messageTranslate("admin.redesign.onThisPage")}
          </span>
        </div>
        <div class="flex gap-2">
          <AuthenticatedButton
            disabled={state.pendingId() !== undefined}
            icon={mdiPlus}
            onClick={() => void state.signingKeyCreate()}
            variant="outline"
          >
            {messageTranslate("admin.oidc.keys.create")}
          </AuthenticatedButton>
          <AuthenticatedButton
            disabled={state.pendingId() !== undefined}
            icon={mdiAutorenew}
            onClick={() => void state.signingKeyRotate()}
            variant="filledBlue"
          >
            {messageTranslate("admin.oidc.keys.rotate")}
          </AuthenticatedButton>
        </div>
      </header>

      <p class="text-xs text-muted-foreground">{messageTranslate("admin.oidc.keys.privateNotice")}</p>

      <OidcAdminNotice notice={state.notice()} />

      <OidcAdminStateBoundary
        emptyDetail={messageTranslate("admin.oidc.keys.empty")}
        error={state.error()}
        onRetry={state.reload}
        status={state.status()}
      >
        <AuthenticatedSection>
          <AuthenticatedRecordList label={messageTranslate("admin.oidc.keys.title")}>
            <For each={state.signingKeys()}>
              {(key) => (
                <AuthenticatedRecordItem
                  actions={retireButton(key)}
                  fields={[
                    { label: messageTranslate("admin.oidc.keys.algorithm"), value: key.algorithm },
                    {
                      label: messageTranslate("admin.oidc.created"),
                      value: <AuthenticatedRelativeTime value={key.createdAt} />,
                    },
                    {
                      label: messageTranslate("admin.oidc.keys.expires"),
                      value: <AuthenticatedRelativeTime value={key.expiresAt} />,
                    },
                    { label: messageTranslate("admin.oidc.keys.retiredAt"), value: retiredAt(key) },
                  ]}
                  status={
                    <AuthenticatedStatus
                      label={messageTranslate(`admin.oidc.keys.statusValue.${key.status}`)}
                      tone={oidcAdminSigningKeyStatusTone(key.status)}
                    />
                  }
                  title={
                    <span class="block truncate font-mono text-xs" title={key.publicJwk.kid}>
                      {key.publicJwk.kid}
                    </span>
                  }
                />
              )}
            </For>
          </AuthenticatedRecordList>

          <Table
            aria-label={messageTranslate("admin.oidc.keys.title")}
            class={authenticatedTableClasses.tableWide}
            tabIndex={0}
          >
            <TableHeader class={authenticatedTableClasses.header}>
              <TableRow>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.oidc.keys.keyId")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.oidc.keys.algorithm")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.oidc.status")}</TableHead>
                <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.oidc.created")}</TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.oidc.keys.expires")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.oidc.keys.retiredAt")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  <span class="sr-only">{messageTranslate("admin.oidc.keys.retire")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.signingKeys()}>
                {(key) => (
                  <TableRow class={authenticatedTableClasses.row}>
                    {/* Key identifiers are long UUIDs, so the cell truncates and keeps the full value in its title. */}
                    <TableCell class={authenticatedTableClasses.identifier} title={key.publicJwk.kid}>
                      <AuthenticatedCopyableId
                        full
                        label={messageTranslate("admin.oidc.keys.keyId")}
                        value={key.publicJwk.kid}
                      />
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap`}>{key.algorithm}</TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <AuthenticatedStatus
                        label={messageTranslate(`admin.oidc.keys.statusValue.${key.status}`)}
                        tone={oidcAdminSigningKeyStatusTone(key.status)}
                      />
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      <AuthenticatedRelativeTime value={key.createdAt} />
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      <AuthenticatedRelativeTime value={key.expiresAt} />
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      {retiredAt(key)}
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.action}>{retireButton(key)}</TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>

          <AuthenticatedPagination
            nextAvailable={state.hasNextPage()}
            onNext={state.pageNext}
            onPrevious={state.pagePrevious}
            previousAvailable={state.hasPreviousPage()}
          />
        </AuthenticatedSection>
      </OidcAdminStateBoundary>
    </section>
  )
}
