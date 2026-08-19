# Last-Modified and 304 for GET requests

## Goal

- Add HTTP conditional GET support using `Last-Modified` and `If-Modified-Since`.
- Return `304 Not Modified` with no body when a GET representation is unchanged.
- Expose the same behavior through the Hono server, public library API clients, and CLI.
- Limit this to single durable-resource GETs whose public body already has `updatedAt`. Do not add it to lists, sessions, credentials, or OIDC protocol endpoints.

## Decisions

- This is a platform HTTP concern. Features only supply a last-modified instant for eligible GET handlers.
- Use `Last-Modified` / `If-Modified-Since` only. Do not add ETags here; optimistic concurrency/ETags stay in `docs/20260818_api-foundations.md`.
- Eligible resources are durable: one persisted entity, public `updatedAt` that changes when that representation changes, returned as a complete GET body. That is the correct `Last-Modified` source.
- Not eligible even if related data exists: list pages, sessions (`lastUsedAt` is activity), machine credentials, passkeys, OIDC signing keys, organization roles, and OIDC protocol/discovery/JWKS.
- Do not use max/latest `updatedAt` for lists or sessions. A `304` means the exact JSON representation is unchanged. Latest item time does not prove that:
  - Lists return only `{ items, nextPageToken? }`. There is no collection timestamp, count, or revision.
  - Pagination is cursor-based. An insert, filter change, or reorder can change the page without raising any remaining item's `updatedAt`.
  - Hard deletes (projects, grants, roles, and others) remove rows without leaving a timestamp on the page. Soft-deleted users do bump `updatedAt`; that does not save collections that hard-delete.
  - Sessions have `lastUsedAt`, not `updatedAt`. That is activity, not a representation watermark, and it misses revocation and other field changes.
- Collection `304` needs a dedicated watermark (collection revision, event-log cursor, or count plus max version stored independently of the page). That is later work, not "use the latest item time".
- Authenticated resource responses send `Last-Modified` plus `Cache-Control: private, no-cache`. That allows revalidation without shared-cache storage.
- `304` is success, not an error. Do not map it through `httpErrorResultCreate`.
- Library GET methods that opt into conditional requests return a platform `HttpGetResult<T>` instead of bare `Result<T>`, so `304` can be represented without inventing a body.
- Library success uses `status: "current" | "unchanged"`. HTTP stays `200`/`304` on the wire. `current` means a body is present (`data`). `unchanged` means no body; the caller reuses its copy. Unconditional GETs still return `current`. Do not use `notModified`, numeric HTTP status as the TypeScript tag, or `ResultErr` for 304.
- CLI remains a thin client of the library. Conditional GET is opt-in via flags; default GET behavior stays unchanged.
- Comparison is HTTP-date second precision. Truncate `updatedAt` to seconds before emitting `Last-Modified` and before comparing to `If-Modified-Since`.
- Invalid `If-Modified-Since` is ignored; the handler returns `200` with the body.
- Unchanged means `lastModified <= ifModifiedSince` after second truncation, per RFC 9110.
- Do not evaluate preconditions before authentication. Unauthorized/forbidden requests still return their error responses.

## Approach

Server:

- Add platform helpers under `src/platform/http/` to parse `If-Modified-Since`, format `Last-Modified`, and decide `200` vs `304`.
- Extend `httpResultResponseCreate` (or a thin `httpConditionalGetResponseCreate` wrapper) so a successful GET can pass `lastModified`.
- On success with a validator:
  - Always set `Last-Modified` and `Cache-Control: private, no-cache`.
  - If the request is GET/HEAD, `If-Modified-Since` is valid, and the resource is unchanged, return `304` with those headers and no JSON body.
  - Otherwise return `200` JSON as today, plus the freshness headers.
- Feature GET handlers for single resources with `updatedAt` pass `lastModified: new Date(resource.updatedAt)` after the action succeeds.
- Keep OIDC `cache-control: no-store` endpoints unchanged. Do not attach validators to authorize, logout, discovery/JWKS, list GETs, session GETs, or future health routes.

Library client:

- Teach `httpApiClientRequest` to inspect status before `response.json()`. `304` has no body.
- Add a small GET options/result type in platform HTTP, used only by methods that support conditional GET:

```ts
type HttpGetOptions = {
  readonly ifModifiedSince?: Date | string
}

type HttpGetResult<T> =
  | {
      readonly success: true
      readonly status: "current"
      readonly data: T
      readonly lastModified?: Date
      readonly requestId?: string
    }
  | {
      readonly success: true
      readonly status: "unchanged"
      readonly lastModified?: Date
      readonly requestId?: string
    }
  | ResultErr
```

- Feature GET methods that participate take an optional last argument:

```ts
projectGet(
  realmId: string,
  projectId: string,
  options?: HttpGetOptions,
): Promise<HttpGetResult<ProjectResponse>>
```

- Map `200` to `{ success: true, status: "current", data, lastModified? }` after schema parse.
- Map `304` to `{ success: true, status: "unchanged", lastModified? }` with no JSON parse. The client does not keep a resource cache.
- Existing mutation and non-conditional methods stay `Promise<Result<T>>`.
- Library consumers:

```ts
const result = await client.projectGet(realmId, projectId, {
  ifModifiedSince: cached.lastModified,
})
if (!result.success) return result
if (result.status === "unchanged") return cached.resource
return result.data
```

CLI:

- Default `get` commands call the client without `If-Modified-Since` and print `result.data` when `status === "current"`.
- Add optional `--if-modified-since <http-date-or-iso>` on participating GET commands.
- If `status === "unchanged"`, print nothing to stdout, set exit code `0`, and write a one-line notice to stderr (for example `304 Not Modified`). Do not invent a resource body.
- Do not add `lastModified` to CLI JSON. The timestamp is already in `updatedAt`.

Tests:

- Platform unit tests for date parse/format, invalid header ignore, second truncation, and `200` vs `304`.
- One feature GET route test proving `Last-Modified` on `200` and `304` on a matching `If-Modified-Since`.
- One API-client test proving `304` does not call JSON parse and returns `status: "unchanged"`.
- One CLI test for `--if-modified-since` producing exit `0` and empty stdout on `304`.

## Tasks

- [x] 1. Add platform HTTP-date helpers and conditional-GET evaluation (`If-Modified-Since` parse, `Last-Modified` format, second-precision compare, ignore-invalid). No feature wiring.
- [x] 2. After task 1, extend the server result-to-response path to emit `Last-Modified` / `Cache-Control` and `304` with no body. Keep current error mapping unchanged.
- [x] 3. After task 2, add `HttpGetOptions` / `HttpGetResult<T>` with `status: "current" | "unchanged"`. Send `If-Modified-Since` and map `200`/`304` before JSON parsing.
- [x] 4. After tasks 2–3, opt single durable-resource GETs with public `updatedAt` into the server helper and matching client method signature. Exclude lists, sessions, credentials, OIDC protocol/discovery/JWKS, and any GET whose public body has no `updatedAt`.
- [x] 5. After task 4, add optional `--if-modified-since` to participating CLI GET commands and handle `304` as success with empty stdout.
- [x] 6. After tasks 1–5, export the new HTTP GET types from the root library surface if they are part of the public client contract, and run `bun run check`.

## Paths

- `src/platform/http/`
- `src/platform/http/httpResultResponseCreate.ts`
- `src/platform/http/httpApiClientRequest.ts`
- `src/outputs/library.ts`
- `src/features/*/server/`
- `src/features/*/client/`
- `src/features/*/cli/`
- `src/features/*/public/`
