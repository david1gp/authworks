import { For } from "solid-js"
import { classMerge } from "#ui/utils/classMerge.js"
import type { AuthenticatedField } from "./authenticatedField.js"

/**
 * Dense definition list for record detail. Labels are small caps above their value so many facts fit
 * a viewport, and identifiers stay single-line monospace with truncation.
 */
export function AuthenticatedFieldList(props: {
  readonly class?: string
  readonly columns?: 2 | 3
  readonly fields: readonly AuthenticatedField[]
}) {
  return (
    <div
      class={classMerge("grid gap-x-4 gap-y-2.5 sm:grid-cols-2", props.columns === 3 && "lg:grid-cols-3", props.class)}
    >
      <For each={props.fields}>
        {(field) => (
          <dl
            class={classMerge(
              "min-w-0",
              field.wide && "sm:col-span-2",
              field.wide && props.columns === 3 && "lg:col-span-3",
            )}
          >
            <dt class="text-2xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">{field.label}</dt>
            <dd
              class={classMerge(
                "mt-0.5 min-w-0 text-sm",
                field.identifier ? "truncate font-mono text-xs text-muted-foreground" : "font-medium",
              )}
              title={field.identifier && typeof field.value === "string" ? field.value : undefined}
            >
              {field.value}
            </dd>
          </dl>
        )}
      </For>
    </div>
  )
}
