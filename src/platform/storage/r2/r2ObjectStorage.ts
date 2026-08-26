import type { Result } from "#result"

export type R2ObjectStorage = {
  readonly delete: (input: { readonly key: string }) => Promise<Result<void>>
  readonly put: (input: {
    readonly body: Uint8Array
    readonly cacheControl: string
    readonly contentType: string
    readonly key: string
  }) => Promise<Result<void>>
}
