import * as v from "valibot"

export const machineScopeSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(128),
  v.regex(/^[a-z][a-zA-Z0-9_.:-]*$/),
)

export type MachineScope = v.InferOutput<typeof machineScopeSchema>
