import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiContentCopy } from "@adaptive-ds/mdi/mdiContentCopy.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import type { organizationAdminPageStateCreate } from "./organizationAdminPageStateCreate.js"
import type { organizationAdminScreenStateCreate } from "./organizationAdminScreenStateCreate.js"

type ConfigurationPage = ReturnType<typeof organizationAdminPageStateCreate>
type ConfigurationScreen = ReturnType<typeof organizationAdminScreenStateCreate>

/** Domains section: list with verification TXT copy, claim dialog, verify, and remove confirm. */
export function OrganizationConfigurationDomainsSection(props: {
  readonly canEdit: boolean
  readonly page: ConfigurationPage
  readonly screen: ConfigurationScreen
}) {
  const claimOpen = createSignalObject(false)
  const removeTarget = createSignalObject<string | undefined>(undefined)
  const copied = createSignalObject(false)

  const copyRecord = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      copied.set(true)
      setTimeout(() => copied.set(false), 2000)
    } catch {
      copied.set(false)
    }
  }

  return (
    <OrganizationAdminState
      emptyDetail={messageTranslate("admin.organizations.domains.empty")}
      error={props.page.error()}
      onRetry={props.page.reload}
      status={props.page.status()}
    >
      <OrganizationAdminNotice notice={props.page.notice()} />
      <AuthenticatedSection
        actions={
          <Show when={props.canEdit}>
            <AuthenticatedButton icon={mdiPlus} onClick={() => claimOpen.set(true)} size="sm" variant="filledBlue">
              {messageTranslate("admin.configuration.claim")}
            </AuthenticatedButton>
          </Show>
        }
        description={messageTranslate("admin.configuration.domainsDescription")}
        title={messageTranslate("admin.configuration.domainsTitle")}
      >
        <Show
          when={props.page.domains().length > 0}
          fallback={
            <p class="px-5 py-4 text-sm text-muted-foreground">
              {messageTranslate("admin.organizations.domains.empty")}
            </p>
          }
        >
          <ul aria-label={messageTranslate("admin.configuration.domainsTitle")} class="divide-y divide-line-subtle">
            <For each={props.page.domains()}>
              {(domain) => (
                <li class="grid min-w-0 gap-3 px-5 py-3.5">
                  <div class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <div class="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 class="min-w-0 truncate font-mono text-sm font-medium" title={domain.domain}>
                        {domain.domain}
                      </h3>
                      <AuthenticatedStatus
                        label={
                          domain.verified
                            ? messageTranslate("admin.organizations.domains.verified")
                            : messageTranslate("admin.organizations.domains.unverified")
                        }
                        tone={domain.verified ? "success" : "warning"}
                      />
                      <Show when={domain.isPrimary}>
                        <AuthenticatedStatus
                          label={messageTranslate("admin.organizations.domains.primary")}
                          tone="accent"
                        />
                      </Show>
                    </div>
                    <Show when={props.canEdit}>
                      <div class="flex flex-wrap items-center gap-1.5">
                        <Show when={!domain.verified}>
                          <AuthenticatedButton
                            disabled={props.page.pendingId() === `domain:${domain.domain}`}
                            icon={mdiCheckCircle}
                            onClick={() => void props.page.domainVerify(domain.domain)}
                            size="sm"
                          >
                            {messageTranslate("admin.organizations.domains.verify")}
                          </AuthenticatedButton>
                        </Show>
                        <AuthenticatedButton
                          disabled={props.page.pendingId() === `domain:${domain.domain}`}
                          icon={mdiDelete}
                          onClick={() => removeTarget.set(domain.domain)}
                          size="sm"
                          variant="outlineRed"
                        >
                          {messageTranslate("admin.organizations.domains.remove")}
                        </AuthenticatedButton>
                      </div>
                    </Show>
                  </div>
                  <Show when={domain.verification}>
                    {(verification) => (
                      <div class="min-w-0 rounded-control border border-line-subtle bg-muted px-2 py-1.5">
                        <p class="text-xs font-medium text-muted-foreground">
                          {messageTranslate("admin.organizations.domains.verificationRecord")}
                        </p>
                        <p class="mt-0.5 break-all font-mono text-xs">
                          {verification().recordType} {verification().recordName} {verification().recordValue}
                        </p>
                        <Show when={props.canEdit}>
                          <div class="mt-1.5">
                            <AuthenticatedButton
                              icon={mdiContentCopy}
                              onClick={() =>
                                void copyRecord(
                                  `${verification().recordType} ${verification().recordName} ${verification().recordValue}`,
                                )
                              }
                              size="sm"
                              variant="outline"
                            >
                              {copied.get()
                                ? messageTranslate("admin.configuration.copied")
                                : messageTranslate("admin.configuration.copy")}
                            </AuthenticatedButton>
                          </div>
                        </Show>
                      </div>
                    )}
                  </Show>
                </li>
              )}
            </For>
          </ul>

          <AuthenticatedPagination
            nextAvailable={props.page.nextPageAvailable()}
            onNext={props.page.nextPageOpen}
            onPrevious={props.page.previousPageOpen}
            previousAvailable={props.page.previousPageAvailable()}
          />
        </Show>
      </AuthenticatedSection>

      <Show when={props.canEdit}>
        <AuthenticatedDialog
          description={messageTranslate("admin.configuration.dialogDescription")}
          onOpenChange={(open) => {
            if (!open) claimOpen.set(false)
          }}
          open={claimOpen.get()}
          title={messageTranslate("admin.configuration.dialogTitle")}
          triggerLabel={<span />}
        >
          <form
            class="grid gap-4"
            onSubmit={(event) => {
              props.screen.domainClaimSubmit(event)
              if (props.screen.form.validationMessage.get() === undefined) claimOpen.set(false)
            }}
          >
            <div class="grid min-w-0 gap-1.5">
              <Label for="configuration-domain-claim">{messageTranslate("admin.configuration.domainName")}</Label>
              <AuthenticatedInput
                id="configuration-domain-claim"
                onInput={(event) => props.screen.form.claimDomain.set(event.currentTarget.value)}
                placeholder={messageTranslate("admin.organizations.domains.placeholder")}
                value={props.screen.form.claimDomain.get()}
              />
            </div>
            <label
              class="flex min-h-10 items-center gap-3 rounded-control border border-line-subtle px-3 py-2 text-[0.8125rem] font-medium"
              for="configuration-domain-claim-primary"
            >
              <input
                checked={props.screen.form.claimPrimary.get()}
                class="size-4 accent-[var(--accent)] disabled:opacity-50"
                id="configuration-domain-claim-primary"
                onChange={() => props.screen.form.claimPrimary.set(!props.screen.form.claimPrimary.get())}
                type="checkbox"
              />
              {messageTranslate("admin.configuration.primaryDomain")}
            </label>
            <Show when={props.screen.form.validationMessage.get()}>
              {(validationMessage) => <AuthenticatedNotice message={validationMessage()} tone="danger" />}
            </Show>
            <div class="flex justify-end gap-2">
              <AuthenticatedButton onClick={() => claimOpen.set(false)} variant="outline">
                {messageTranslate("common.cancel")}
              </AuthenticatedButton>
              <AuthenticatedButton
                disabled={props.page.pendingId() === "domain:claim"}
                icon={mdiPlus}
                type="submit"
                variant="filledBlue"
              >
                {messageTranslate("admin.configuration.claim")}
              </AuthenticatedButton>
            </div>
          </form>
        </AuthenticatedDialog>

        <AuthenticatedDialog
          description={messageTranslate("admin.configuration.removeConfirm", { domain: removeTarget.get() ?? "" })}
          onOpenChange={(open) => {
            if (!open) removeTarget.set(undefined)
          }}
          open={removeTarget.get() !== undefined}
          title={messageTranslate("admin.configuration.removeTitle")}
          triggerLabel={<span />}
        >
          <div class="flex justify-end gap-2">
            <AuthenticatedButton onClick={() => removeTarget.set(undefined)} variant="outline">
              {messageTranslate("common.cancel")}
            </AuthenticatedButton>
            <AuthenticatedButton
              disabled={removeTarget.get() === undefined}
              icon={mdiDelete}
              onClick={() => {
                const domain = removeTarget.get()
                removeTarget.set(undefined)
                if (domain !== undefined) void props.page.domainRemove(domain)
              }}
              variant="filledRed"
            >
              {messageTranslate("common.continue")}
            </AuthenticatedButton>
          </div>
        </AuthenticatedDialog>
      </Show>
    </OrganizationAdminState>
  )
}
