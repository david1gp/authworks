import * as v from "valibot"

const providerSchema = v.strictObject({
  sourceId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(320))),
  clientId: v.pipe(v.string(), v.minLength(1), v.maxLength(320)),
  clientSecret: v.pipe(v.string(), v.minLength(1), v.maxLength(4096)),
  scopes: v.optional(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(128)))),
  type: v.picklist(["google", "github", "microsoft"]),
})
const originSchema = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    )
  }, "The destination origin must be an HTTPS origin."),
  v.transform((value) => value.replace(/\/$/, "")),
)
export const zitadelMigrationProviderCredentialBundleSchema = v.pipe(
  v.strictObject({
    bundleVersion: v.literal(1),
    destinationOrigin: originSchema,
    providers: v.pipe(v.array(providerSchema), v.minLength(1)),
    sourceInstance: v.pipe(v.string(), v.url()),
  }),
  v.check((bundle) => {
    const keys = bundle.providers.map(
      (provider) => `${provider.type}\u0000${provider.sourceId ?? `client:${provider.clientId}`}`,
    )
    return new Set(keys).size === keys.length
  }, "Provider credentials must be unique."),
)
export type ZitadelMigrationProviderCredentialBundle = v.InferOutput<
  typeof zitadelMigrationProviderCredentialBundleSchema
>
