import { createEffect, on, onCleanup } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { Event } from "../../events/public/eventSchema.js"
import type { AdminActivityAdapter } from "./adminActivityAdapter.js"

/** The context accessors must reflect the live selection, not its initial value. */
export function adminActivityStateCreate(options: {
  readonly adapter: AdminActivityAdapter
  readonly realmId: () => string
  readonly organizationId: () => string | undefined
  readonly pageSize?: number
}) {
  const status = createSignalObject<"loading" | "ready" | "empty" | "error" | "permission-denied">("loading")
  const error = createSignalObject<string | undefined>(undefined)
  const events = createSignalObject<readonly Event[]>([])
  const tokens = createSignalObject<readonly string[]>([])
  const nextToken = createSignalObject<string | undefined>(undefined)
  let generation = 0
  let disposed = false
  const load = async () => {
    const id = ++generation
    const realm = options.realmId()
    const organization = options.organizationId()
    const token = tokens.get().at(-1)
    status.set("loading")
    error.set(undefined)
    events.set([])
    nextToken.set(undefined)
    const query = { pageSize: options.pageSize ?? 20, ...(token === undefined ? {} : { pageToken: token }) }
    const result =
      organization !== undefined
        ? await options.adapter.organizationList(realm, organization, query)
        : await options.adapter.realmList(realm, query)
    if (disposed || id !== generation || realm !== options.realmId() || organization !== options.organizationId())
      return
    if (!result.success) {
      error.set(result.errorMessage)
      status.set(result.statusCode === 403 ? "permission-denied" : "error")
      return
    }
    events.set(result.data.items)
    nextToken.set(result.data.nextPageToken)
    status.set(result.data.items.length === 0 ? "empty" : "ready")
  }
  createEffect(
    on(
      () => [options.realmId(), options.organizationId()] as const,
      () => {
        tokens.set([])
        void load()
      },
    ),
  )
  onCleanup(() => {
    disposed = true
    generation++
  })
  return {
    status: status.get,
    error: error.get,
    events: events.get,
    hasNextPage: () => nextToken.get() !== undefined,
    hasPreviousPage: () => tokens.get().length > 0,
    retry: () => void load(),
    pageNext: () => {
      const token = nextToken.get()
      if (token === undefined || status.get() === "loading") return
      tokens.set([...tokens.get(), token])
      void load()
    },
    pagePrevious: () => {
      if (tokens.get().length === 0 || status.get() === "loading") return
      tokens.set(tokens.get().slice(0, -1))
      void load()
    },
  }
}
