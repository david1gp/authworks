import { mdiChevronDown } from "@adaptive-ds/mdi/mdiChevronDown.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiRestore } from "@adaptive-ds/mdi/mdiRestore.js"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedControlClasses } from "../../../ui/authenticated/authenticatedControlClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import { OrganizationConfigurationPreviewCard } from "./OrganizationConfigurationPreviewCard.js"
import type {
  OrganizationConfigurationBrandingState,
  OrganizationConfigurationThemeColorKey,
  OrganizationConfigurationThemeKey,
} from "./organizationConfigurationBrandingStateCreate.js"

const colorFields = [
  { key: "primaryColor", labelKey: "admin.organizations.branding.primary" },
  { key: "backgroundColor", labelKey: "admin.organizations.branding.background" },
  { key: "fontColor", labelKey: "admin.organizations.branding.font" },
  { key: "warnColor", labelKey: "admin.organizations.branding.warn" },
] as const satisfies readonly { key: OrganizationConfigurationThemeColorKey; labelKey: string }[]

type ThemeMode = "dark" | "light" | "system"

/** Branding section: two-column desktop layout with a sticky live preview and sticky save bar. */
export function OrganizationConfigurationBrandingSection(props: {
  readonly branding: OrganizationConfigurationBrandingState
  readonly canEdit: boolean
  readonly notice?: string
  readonly organizationName?: string
  readonly previewTheme: OrganizationConfigurationThemeKey
  readonly previewThemeSet: (theme: OrganizationConfigurationThemeKey) => void
  readonly status: string
  readonly statusError?: string
  readonly statusRetry: () => void
}) {
  const state = props.branding
  return (
    <OrganizationAdminState
      emptyDetail={messageTranslate("admin.organizations.configuration.brandingDescription")}
      error={props.statusError}
      onRetry={props.statusRetry}
      status={props.status as "empty" | "error" | "loading" | "ready"}
    >
      <div class="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] [&>*]:min-w-0">
        <div class="grid min-w-0 gap-5 [&>*]:min-w-0">
          <AuthenticatedSection
            description={messageTranslate("admin.configuration.brandingFormDescription")}
            title={messageTranslate("admin.configuration.brandingFormTitle")}
          >
            <form
              class="grid gap-5 px-5 py-4 [&_label]:text-[0.8125rem]"
              onSubmit={(event) => {
                event.preventDefault()
                void state.save()
              }}
            >
              <div class="grid min-w-0 gap-5 [&>*]:min-w-0">
                <For each={["light", "dark"] as const}>
                  {(theme) => (
                    <fieldset class="grid min-w-0 gap-4 [&>*]:min-w-0">
                      <legend class="text-sm font-semibold">
                        {theme === "light"
                          ? messageTranslate("admin.configuration.themeLight")
                          : messageTranslate("admin.configuration.themeDark")}
                      </legend>
                      <div class="grid gap-4 sm:grid-cols-2">
                        <For each={colorFields}>
                          {(field) => {
                            const id = `configuration-branding-${theme}-${field.key}`
                            return (
                              <div class="grid min-w-0 gap-1.5">
                                <Label for={id}>{messageTranslate(field.labelKey)}</Label>
                                <div class="flex items-center gap-2">
                                  <input
                                    aria-label={messageTranslate(field.labelKey)}
                                    class={`${authenticatedControlClasses.input} max-w-9 shrink-0 cursor-pointer`}
                                    disabled={!props.canEdit}
                                    onInput={(event) =>
                                      state.themeColorSet(theme, field.key, event.currentTarget.value)
                                    }
                                    style={{ padding: "4px" }}
                                    type="color"
                                    value={state.themeColor(theme, field.key)}
                                  />
                                  <AuthenticatedInput
                                    class="min-w-0 font-mono text-xs"
                                    disabled={!props.canEdit}
                                    id={id}
                                    onInput={(event) =>
                                      state.themeColorSet(theme, field.key, event.currentTarget.value)
                                    }
                                    value={state.themeColor(theme, field.key)}
                                  />
                                </div>
                              </div>
                            )
                          }}
                        </For>
                      </div>
                      <div class="grid gap-4 border-t border-line-subtle pt-4 sm:grid-cols-2">
                        <div class="grid min-w-0 gap-1">
                          <Label for={`configuration-branding-${theme}-logoUrl`}>
                            {messageTranslate("admin.organizations.branding.logoUrl")}
                          </Label>
                          <AuthenticatedInput
                            disabled={!props.canEdit}
                            id={`configuration-branding-${theme}-logoUrl`}
                            onInput={(event) => state.themeAssetSet(theme, "logoUrl", event.currentTarget.value)}
                            placeholder={messageTranslate("common.urlPlaceholder")}
                            value={state.themeAsset(theme, "logoUrl")}
                          />
                        </div>
                        <div class="grid min-w-0 gap-1">
                          <Label for={`configuration-branding-${theme}-iconUrl`}>
                            {messageTranslate("admin.organizations.branding.iconUrl")}
                          </Label>
                          <AuthenticatedInput
                            disabled={!props.canEdit}
                            id={`configuration-branding-${theme}-iconUrl`}
                            onInput={(event) => state.themeAssetSet(theme, "iconUrl", event.currentTarget.value)}
                            placeholder={messageTranslate("common.urlPlaceholder")}
                            value={state.themeAsset(theme, "iconUrl")}
                          />
                        </div>
                      </div>
                    </fieldset>
                  )}
                </For>
              </div>

              <div class="grid gap-4 border-t border-line-subtle pt-4">
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="grid min-w-0 gap-1">
                    <Label for="configuration-branding-theme-mode">
                      {messageTranslate("admin.organizations.branding.themeMode")}
                    </Label>
                    <div class="relative w-full min-w-0">
                      <select
                        class={`${authenticatedControlClasses.select} appearance-none pe-9`}
                        disabled={!props.canEdit}
                        id="configuration-branding-theme-mode"
                        onChange={(event) => state.themeModeSet(event.currentTarget.value as ThemeMode)}
                        value={state.themeMode()}
                      >
                        <option value="system">{messageTranslate("common.theme.system")}</option>
                        <option value="light">{messageTranslate("common.theme.light")}</option>
                        <option value="dark">{messageTranslate("common.theme.dark")}</option>
                      </select>
                      <Icon
                        class="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        path={mdiChevronDown}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Show when={state.colorError() !== undefined || state.urlError() !== undefined}>
                <AuthenticatedNotice
                  message={messageTranslate(
                    state.colorError() !== undefined
                      ? "admin.configuration.colorInvalid"
                      : "admin.organizations.providers.invalid",
                  )}
                  tone="danger"
                />
              </Show>
            </form>
          </AuthenticatedSection>

          <AuthenticatedSection
            description={messageTranslate("admin.configuration.fontDescription")}
            title={messageTranslate("admin.configuration.fontTitle")}
          >
            <div class="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <div class="grid min-w-0 gap-1">
                <Label for="configuration-branding-font-family">
                  {messageTranslate("admin.configuration.fontFamily")}
                </Label>
                <AuthenticatedInput
                  disabled={!props.canEdit}
                  id="configuration-branding-font-family"
                  onInput={(event) => state.fontFamilySet(event.currentTarget.value)}
                  placeholder={messageTranslate("admin.configuration.fontFamilyPlaceholder")}
                  value={state.fontFamily()}
                />
              </div>
              <div class="grid min-w-0 gap-1">
                <Label for="configuration-branding-font-url">{messageTranslate("admin.configuration.fontUrl")}</Label>
                <AuthenticatedInput
                  disabled={!props.canEdit}
                  id="configuration-branding-font-url"
                  onInput={(event) => state.fontUrlSet(event.currentTarget.value)}
                  placeholder={messageTranslate("common.urlPlaceholder")}
                  value={state.fontUrl()}
                />
              </div>
            </div>
            <Show when={!state.urlValid(state.fontUrl())}>
              <div class="px-5 pb-4">
                <AuthenticatedNotice message={messageTranslate("admin.configuration.colorInvalid")} tone="danger" />
              </div>
            </Show>
          </AuthenticatedSection>

          <AuthenticatedSection
            description={messageTranslate("admin.configuration.legalDescription")}
            title={messageTranslate("admin.configuration.legalTitle")}
          >
            <div class="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <div class="grid min-w-0 gap-1">
                <Label for="configuration-branding-privacy">{messageTranslate("admin.configuration.privacyUrl")}</Label>
                <AuthenticatedInput
                  disabled={!props.canEdit}
                  id="configuration-branding-privacy"
                  onInput={(event) => state.legalUrlSet("privacyUrl", event.currentTarget.value)}
                  placeholder={messageTranslate("common.urlPlaceholder")}
                  value={state.legalPrivacyUrl()}
                />
              </div>
              <div class="grid min-w-0 gap-1">
                <Label for="configuration-branding-terms">{messageTranslate("admin.configuration.termsUrl")}</Label>
                <AuthenticatedInput
                  disabled={!props.canEdit}
                  id="configuration-branding-terms"
                  onInput={(event) => state.legalUrlSet("termsUrl", event.currentTarget.value)}
                  placeholder={messageTranslate("common.urlPlaceholder")}
                  value={state.legalTermsUrl()}
                />
              </div>
            </div>
            <label
              class="mx-5 mb-4 flex min-h-10 items-center gap-3 rounded-control border border-line-subtle px-3 py-2 text-[0.8125rem] font-medium"
              for="configuration-branding-watermark"
            >
              <input
                checked={state.watermark()}
                class={authenticatedControlClasses.checkbox}
                disabled={!props.canEdit}
                id="configuration-branding-watermark"
                onChange={state.watermarkToggle}
                type="checkbox"
              />
              {messageTranslate("admin.configuration.watermark")}
            </label>
          </AuthenticatedSection>
        </div>

        <div class="grid min-w-0 gap-4 xl:sticky xl:top-4 [&>*]:min-w-0">
          <AuthenticatedSection
            actions={
              <div class="flex items-center gap-1.5">
                <AuthenticatedButton
                  onClick={() => props.previewThemeSet("light")}
                  size="sm"
                  variant={props.previewTheme === "light" ? "filledBlue" : "outline"}
                >
                  {messageTranslate("admin.configuration.previewLight")}
                </AuthenticatedButton>
                <AuthenticatedButton
                  onClick={() => props.previewThemeSet("dark")}
                  size="sm"
                  variant={props.previewTheme === "dark" ? "filledBlue" : "outline"}
                >
                  {messageTranslate("admin.configuration.previewDark")}
                </AuthenticatedButton>
              </div>
            }
            description={messageTranslate("admin.configuration.previewDescription")}
            title={messageTranslate("admin.configuration.previewTitle")}
          >
            <div class="px-5 py-4">
              <OrganizationConfigurationPreviewCard
                branding={state.branding()}
                organizationName={props.organizationName ?? messageTranslate("app.name")}
                theme={props.previewTheme}
              />
            </div>
          </AuthenticatedSection>
        </div>
      </div>

      <Show when={state.dirty() && props.canEdit}>
        <div class="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-2 rounded-panel border border-line bg-surface px-4 py-3 shadow-panel">
          <div class="flex items-center gap-2">
            <AuthenticatedStatus label={messageTranslate("admin.configuration.dirty")} tone="warning" />
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <AuthenticatedButton icon={mdiRestore} onClick={state.discard} size="sm" variant="outline">
              {messageTranslate("admin.configuration.discard")}
            </AuthenticatedButton>
            <AuthenticatedButton icon={mdiContentSave} onClick={() => void state.save()} size="sm" variant="filledBlue">
              {messageTranslate("common.save")}
            </AuthenticatedButton>
          </div>
        </div>
      </Show>
    </OrganizationAdminState>
  )
}
