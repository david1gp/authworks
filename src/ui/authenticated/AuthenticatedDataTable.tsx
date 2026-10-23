import { mdiArrowDown } from "@adaptive-ds/mdi/mdiArrowDown.js"
import { mdiArrowUp } from "@adaptive-ds/mdi/mdiArrowUp.js"
import { A } from "@solidjs/router"
import { For, type JSX, Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { AuthenticatedSkeleton } from "./AuthenticatedSkeleton.js"
import type { AuthenticatedDataTableColumn } from "./authenticatedDataTableColumn.js"
import type { AuthenticatedDataTableSort } from "./authenticatedDataTableSort.js"
import { authenticatedDataTableStateCreate } from "./authenticatedDataTableStateCreate.js"
import { authenticatedTableClasses } from "./authenticatedTableClasses.js"

function AuthenticatedDataTableHeaderCell<T>(props: {
  readonly activeSort: AuthenticatedDataTableSort | undefined
  readonly column: AuthenticatedDataTableColumn<T>
  readonly onToggle: () => void
}) {
  const sortActive = () => props.activeSort?.key === props.column.sortKey
  const sortDirection = () => (sortActive() ? (props.activeSort?.direction ?? "asc") : undefined)
  return (
    <Show
      when={props.column.sortKey !== undefined}
      fallback={
        <th class={classMerge(authenticatedTableClasses.head, props.column.align === "end" && "text-end")} scope="col">
          {props.column.header}
        </th>
      }
    >
      <th
        aria-sort={sortDirection() === undefined ? "none" : sortDirection() === "asc" ? "ascending" : "descending"}
        class={classMerge(authenticatedTableClasses.head, props.column.align === "end" && "text-end")}
        scope="col"
      >
        <button
          aria-label={messageTranslate("ui.authenticated.sortBy", { column: props.column.header })}
          class="inline-flex items-center gap-1 rounded-sm font-medium hover:text-foreground"
          onClick={props.onToggle}
          type="button"
        >
          <span>{props.column.header}</span>
          <Show when={sortDirection()}>
            <Icon aria-hidden="true" class="size-3.5" path={sortDirection() === "asc" ? mdiArrowUp : mdiArrowDown} />
          </Show>
        </button>
      </th>
    </Show>
  )
}

function AuthenticatedDataTableBodyRow<T>(props: {
  readonly columns: readonly AuthenticatedDataTableColumn<T>[]
  readonly onRowClick?: (row: T) => void
  readonly row: T
  readonly rowHref?: string
  readonly rowKey: string
}) {
  const clickable = () => props.rowHref !== undefined || props.onRowClick !== undefined
  return (
    <tr
      class={classMerge(
        authenticatedTableClasses.row,
        clickable() && "focus-within:bg-surface-hover hover:bg-surface-hover",
      )}
      data-row-key={props.rowKey}
    >
      <For each={props.columns}>
        {(column) => (
          <td class={classMerge(authenticatedTableClasses.cell, column.class, column.align === "end" && "text-end")}>
            <Show
              when={typeof props.rowHref === "string" && props.rowHref.length > 0}
              fallback={
                <Show when={props.onRowClick !== undefined} fallback={column.cell(props.row)}>
                  <button
                    class="block w-full cursor-pointer rounded-sm text-start"
                    onClick={() => props.onRowClick?.(props.row)}
                    type="button"
                  >
                    {column.cell(props.row)}
                  </button>
                </Show>
              }
            >
              {(href) => (
                <A class="block rounded-sm" href={String(href())}>
                  {column.cell(props.row)}
                </A>
              )}
            </Show>
          </td>
        )}
      </For>
    </tr>
  )
}

/**
 * Generic dense table: sortable headers with `aria-sort`, optional whole-row links that stay
 * keyboard reachable, skeleton rows while loading, and an `empty` slot. Scrolls horizontally
 * below the `sm` breakpoint instead of clipping columns.
 */
export function AuthenticatedDataTable<T>(props: {
  readonly activeSort?: AuthenticatedDataTableSort
  readonly caption: string
  readonly class?: string
  readonly columns: readonly AuthenticatedDataTableColumn<T>[]
  readonly empty?: () => JSX.Element
  readonly loading?: boolean
  readonly onRowClick?: (row: T) => void
  readonly onSortChange?: (sort: AuthenticatedDataTableSort) => void
  readonly rowHref?: (row: T) => string | undefined
  readonly rowKey: (row: T, index: number) => string
  readonly rows: readonly T[]
  readonly skeletonRows?: number
}) {
  const state = authenticatedDataTableStateCreate({
    activeSort: () => props.activeSort,
    loading: () => props.loading ?? false,
    onSortChange: props.onSortChange,
    rows: () => props.rows,
  })
  return (
    <Show
      when={state.showEmpty()}
      fallback={
        <div class={classMerge("overflow-x-auto", props.class)}>
          <table class={authenticatedTableClasses.table}>
            <caption class="sr-only">{props.caption}</caption>
            <thead class={classMerge(authenticatedTableClasses.header, "[&_th]:sticky [&_th]:top-0")}>
              <tr>
                <For each={props.columns}>
                  {(column) => (
                    <AuthenticatedDataTableHeaderCell
                      activeSort={props.activeSort}
                      column={column}
                      onToggle={state.sortToggle(column.sortKey ?? "")}
                    />
                  )}
                </For>
              </tr>
            </thead>
            <tbody>
              <Show
                when={!props.loading}
                fallback={
                  <For each={Array.from({ length: props.skeletonRows ?? 4 }, (_, index) => index)}>
                    {(skeletonIndex) => (
                      <tr class={authenticatedTableClasses.row}>
                        <For each={props.columns}>
                          {() => (
                            <td class={authenticatedTableClasses.cell}>
                              <AuthenticatedSkeleton class="h-4 w-3/4" index={skeletonIndex} />
                            </td>
                          )}
                        </For>
                      </tr>
                    )}
                  </For>
                }
              >
                <For each={state.rows()}>
                  {(row, index) => (
                    <AuthenticatedDataTableBodyRow
                      columns={props.columns}
                      onRowClick={props.onRowClick}
                      row={row as T}
                      rowHref={props.rowHref?.(row as T)}
                      rowKey={props.rowKey(row as T, index())}
                    />
                  )}
                </For>
              </Show>
            </tbody>
          </table>
        </div>
      }
    >
      <div class={props.class}>{props.empty?.()}</div>
    </Show>
  )
}
