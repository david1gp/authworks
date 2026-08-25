import * as v from "valibot"

export const configurationSchema = v.strictObject({
  databasePath: v.pipe(v.string(), v.minLength(1)),
  host: v.pipe(v.string(), v.minLength(1)),
  accountUiOrigin: v.pipe(v.string(), v.url()),
  nodeEnv: v.picklist(["development", "test", "production"]),
  port: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535)),
  publicOrigin: v.pipe(v.string(), v.url()),
  trustedProxyAddresses: v.array(v.pipe(v.string(), v.minLength(1))),
})

export type Configuration = v.InferOutput<typeof configurationSchema>
