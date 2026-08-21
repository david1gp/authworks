import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

export type LoginLegalSegment =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "privacy" | "terms"; readonly value: string }

const termsToken = "[[terms]]"
const privacyToken = "[[privacy]]"

/**
 * Splits the translated legal sentence into text and link segments so each locale keeps control of
 * where the Terms and Privacy links appear inside its own wording.
 */
export function loginLegalSegmentsGet(): readonly LoginLegalSegment[] {
  const sentence = messageTranslate("login.common.legal", { privacy: privacyToken, terms: termsToken })
  return sentence
    .split(/(\[\[terms\]\]|\[\[privacy\]\])/)
    .filter((part) => part.length > 0)
    .map((part) =>
      part === termsToken
        ? { kind: "terms" as const, value: messageTranslate("login.common.terms") }
        : part === privacyToken
          ? { kind: "privacy" as const, value: messageTranslate("login.common.privacy") }
          : { kind: "text" as const, value: part },
    )
}
