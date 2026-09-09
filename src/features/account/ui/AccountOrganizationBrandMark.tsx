import { mdiOfficeBuildingOutline } from "@adaptive-ds/mdi/mdiOfficeBuildingOutline.js"
import { Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import type { OrganizationBranding } from "../../organizations/public/organizationBrandingSchema.js"
import { accountOrganizationBrandMarkStateCreate } from "./accountOrganizationBrandMarkStateCreate.js"

export function AccountOrganizationBrandMark(props: {
  readonly branding?: OrganizationBranding
  readonly class?: string
}) {
  const state = accountOrganizationBrandMarkStateCreate(() => props.branding)
  return (
    <span
      aria-hidden="true"
      class={classMerge(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-control border border-line bg-surface text-muted-foreground shadow-xs",
        props.class,
      )}
    >
      <Icon class="size-1/2" path={mdiOfficeBuildingOutline} />
      <Show when={state.lightUrl()}>
        {(url) => (
          <img alt="" class="absolute inset-0 size-full bg-surface object-contain p-1 dark:hidden" src={url()} />
        )}
      </Show>
      <Show when={state.darkUrl()}>
        {(url) => (
          <img alt="" class="absolute inset-0 hidden size-full bg-surface object-contain p-1 dark:block" src={url()} />
        )}
      </Show>
    </span>
  )
}
