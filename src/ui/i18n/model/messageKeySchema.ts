import * as v from "valibot"

import { englishCatalog } from "./englishCatalog.js"

type EnglishMessageKey = keyof typeof englishCatalog

const messageKeys = Object.keys(englishCatalog) as [EnglishMessageKey, ...EnglishMessageKey[]]

export const messageKeySchema = v.picklist(messageKeys)

export type MessageKey = v.InferOutput<typeof messageKeySchema>
