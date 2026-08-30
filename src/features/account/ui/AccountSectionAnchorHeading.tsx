import { mdiLinkVariant } from "@adaptive-ds/mdi/mdiLinkVariant.js"
import { Icon } from "#ui/static/icon/Icon.jsx"

/** Section heading whose title is a clickable permalink to the section's stable anchor. */
export function AccountSectionAnchorHeading(props: { readonly id: string; readonly title: string }) {
  return (
    <h2 class="text-lg font-semibold tracking-tight" id={`account-workspace-${props.id}-title`}>
      <a
        class="group inline-flex items-center gap-1.5 rounded-control text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        href={`#${props.id}`}
      >
        <span>{props.title}</span>
        <Icon
          class="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          path={mdiLinkVariant}
        />
      </a>
    </h2>
  )
}
