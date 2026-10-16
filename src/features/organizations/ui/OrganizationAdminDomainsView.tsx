import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { mdiMagnify } from "@adaptive-ds/mdi/mdiMagnify.js"
import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedControlClasses } from "../../../ui/authenticated/authenticatedControlClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationDomain } from "../public/organizationDomainSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"

export function OrganizationAdminDomainsView(props: {
  readonly claimDomain: string
  readonly claimPrimary: boolean
  readonly discoveryDomain: string
  readonly discoveryMessage?: string
  readonly domains: readonly OrganizationDomain[]
  readonly error?: string
  readonly nextPageAvailable: boolean
  readonly notice?: string
  readonly onClaimDomainInput: (value: string) => void
  readonly onClaimPrimaryToggle: () => void
  readonly onClaimSubmit: (event: SubmitEvent) => void
  readonly onDiscoveryDomainInput: (value: string) => void
  readonly onDiscoverySubmit: (event: SubmitEvent) => void
  readonly onNextPage: () => void
  readonly onPreviousPage: () => void
  readonly onRemove: (domain: string) => void
  readonly onRetry: () => void
  readonly onVerify: (domain: string) => void
  readonly pendingId?: string
  readonly previousPageAvailable: boolean
  readonly status: OrganizationAdminStatus
  readonly validationMessage?: string
}) {
  return (
    <AuthenticatedPageBody>
      <OrganizationAdminNotice notice={props.notice} />

      <div class="grid min-w-0 gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <AuthenticatedSection
          description={messageTranslate("admin.organizations.domains.description")}
          title={messageTranslate("admin.organizations.domains.claim")}
        >
          <form class="grid max-w-3xl gap-4 px-5 py-4 [&_label]:text-[0.8125rem]" onSubmit={props.onClaimSubmit}>
            <div class="grid items-end gap-4">
              <div class="grid min-w-0 gap-1.5">
                <Label for="domain-claim">{messageTranslate("admin.organizations.domains.domain")}</Label>
                <AuthenticatedInput
                  id="domain-claim"
                  onInput={(event) => props.onClaimDomainInput(event.currentTarget.value)}
                  placeholder={messageTranslate("admin.organizations.domains.placeholder")}
                  value={props.claimDomain}
                />
              </div>
            </div>
            <label
              class="flex min-h-10 items-center gap-3 rounded-control border border-line-subtle px-3 py-2 text-[0.8125rem] font-medium"
              for="domain-claim-primary"
            >
              <input
                checked={props.claimPrimary}
                class={authenticatedControlClasses.checkbox}
                id="domain-claim-primary"
                onChange={props.onClaimPrimaryToggle}
                type="checkbox"
              />
              {messageTranslate("admin.organizations.domains.primary")}
            </label>
            <Show when={props.validationMessage}>
              {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
            </Show>
            <div class="flex justify-end">
              <AuthenticatedButton
                disabled={props.pendingId === "domain:claim"}
                icon={mdiPlus}
                type="submit"
                variant="filledBlue"
              >
                {messageTranslate("admin.organizations.domains.claim")}
              </AuthenticatedButton>
            </div>
          </form>
        </AuthenticatedSection>

        <AuthenticatedSection
          description={messageTranslate("admin.organizations.domains.discoveryDescription")}
          title={messageTranslate("admin.organizations.domains.discovery")}
        >
          <form class="grid max-w-3xl gap-4 px-5 py-4 [&_label]:text-[0.8125rem]" onSubmit={props.onDiscoverySubmit}>
            <div class="grid items-end gap-4">
              <div class="grid min-w-0 gap-1.5">
                <Label for="domain-discovery">{messageTranslate("admin.organizations.domains.domain")}</Label>
                <AuthenticatedInput
                  id="domain-discovery"
                  onInput={(event) => props.onDiscoveryDomainInput(event.currentTarget.value)}
                  placeholder={messageTranslate("admin.organizations.domains.placeholder")}
                  value={props.discoveryDomain}
                />
              </div>
              <AuthenticatedButton
                class="justify-self-end"
                disabled={props.pendingId === "domain:discover"}
                icon={mdiMagnify}
                type="submit"
                variant="outline"
              >
                {messageTranslate("admin.organizations.domains.discovery")}
              </AuthenticatedButton>
            </div>
            <Show when={props.discoveryMessage}>
              {(message) => (
                <p
                  class="rounded-control border border-line-subtle bg-muted px-2 py-1.5 text-xs text-muted-foreground"
                  role="status"
                >
                  {message()}
                </p>
              )}
            </Show>
          </form>
        </AuthenticatedSection>
      </div>

      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.domains.empty")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <AuthenticatedSection title={messageTranslate("admin.organizations.domains.title")}>
          <ul aria-label={messageTranslate("admin.organizations.domains.title")} class="divide-y divide-line-subtle">
            <For each={props.domains}>
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
                    <div class="flex flex-wrap items-center gap-1.5">
                      <Show when={!domain.verified}>
                        <AuthenticatedButton
                          size="sm"
                          disabled={props.pendingId === `domain:${domain.domain}`}
                          icon={mdiCheckCircle}
                          onClick={() => props.onVerify(domain.domain)}
                        >
                          {messageTranslate("admin.organizations.domains.verify")}
                        </AuthenticatedButton>
                      </Show>
                      <AuthenticatedButton
                        size="sm"
                        disabled={props.pendingId === `domain:${domain.domain}`}
                        icon={mdiDelete}
                        onClick={() => props.onRemove(domain.domain)}
                        variant="outline"
                      >
                        {messageTranslate("admin.organizations.domains.remove")}
                      </AuthenticatedButton>
                    </div>
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
                      </div>
                    )}
                  </Show>
                </li>
              )}
            </For>
          </ul>

          <AuthenticatedPagination
            nextAvailable={props.nextPageAvailable}
            onNext={props.onNextPage}
            onPrevious={props.onPreviousPage}
            previousAvailable={props.previousPageAvailable}
          />
        </AuthenticatedSection>
      </OrganizationAdminState>
    </AuthenticatedPageBody>
  )
}
