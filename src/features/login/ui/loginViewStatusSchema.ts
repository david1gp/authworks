import * as v from "valibot"

export const loginViewStatusSchema = v.picklist(["loading", "ready", "continuing", "fatal", "unavailable", "verified"])

export type LoginViewStatus = v.InferOutput<typeof loginViewStatusSchema>
