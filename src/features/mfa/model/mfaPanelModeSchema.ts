import * as v from "valibot"

export const mfaPanelModeSchema = v.picklist(["enroll", "loading", "optional", "satisfied", "select", "unavailable"])

export type MfaPanelMode = v.InferOutput<typeof mfaPanelModeSchema>
