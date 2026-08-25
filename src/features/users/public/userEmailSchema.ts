import * as v from "valibot"

export const userEmailSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(3),
  v.maxLength(320),
  v.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
)

export type UserEmail = v.InferOutput<typeof userEmailSchema>
