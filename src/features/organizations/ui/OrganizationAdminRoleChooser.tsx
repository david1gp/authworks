import { For } from "solid-js"
import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"
import type { OrganizationRole } from "../public/organizationRoleSchema.js"

/** Assigns the fixed Authworks organization roles; the role set itself is read-only. */
export function OrganizationAdminRoleChooser(props: {
  readonly disabled?: boolean
  readonly idPrefix: string
  readonly legend: string
  readonly legendHidden?: boolean
  readonly onToggle: (role: OrganizationRoleId) => void
  readonly roles: readonly OrganizationRole[]
  readonly selected: readonly OrganizationRoleId[]
}) {
  return (
    <fieldset class="grid gap-2">
      <legend class={props.legendHidden ? "sr-only" : "text-sm font-medium"}>{props.legend}</legend>
      <div class="flex flex-wrap gap-3">
        <For each={props.roles}>
          {(role) => {
            const id = `${props.idPrefix}-role-${role.id}`
            return (
              <label class="flex items-center gap-2 text-sm" for={id}>
                <input
                  checked={props.selected.includes(role.id)}
                  class="size-4 rounded border-line"
                  disabled={props.disabled}
                  id={id}
                  onChange={() => props.onToggle(role.id)}
                  type="checkbox"
                />
                {role.name}
              </label>
            )
          }}
        </For>
      </div>
    </fieldset>
  )
}
