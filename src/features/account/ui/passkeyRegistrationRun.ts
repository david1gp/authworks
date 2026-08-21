import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { PasskeyRegistrationCompleteRequest } from "../../passkeys/public/passkeyRegistrationCompleteRequestSchema.js"
import type { PasskeyRegistrationStartResponse } from "../../passkeys/public/passkeyRegistrationStartResponseSchema.js"

const base64UrlDecode = (value: string) => {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=")
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

const base64UrlEncode = (value: ArrayBuffer) => {
  const bytes = new Uint8Array(value)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export async function passkeyRegistrationRun(start: PasskeyRegistrationStartResponse) {
  const op = "passkeyRegistrationRun"
  if (navigator.credentials === undefined)
    return resultErrorCodedCreate(op, "Passkeys are not supported by this browser.", "passkeys.invalid")

  try {
    const options = start.options
    const credential = (await navigator.credentials.create({
      publicKey: {
        ...options,
        challenge: base64UrlDecode(options.challenge),
        excludeCredentials: options.excludeCredentials?.map((item) => ({
          ...item,
          id: base64UrlDecode(item.id),
          transports: item.transports?.filter(
            (transport): transport is AuthenticatorTransport => transport !== "cable" && transport !== "smart-card",
          ),
        })),
        user: { ...options.user, id: base64UrlDecode(options.user.id) },
      },
    })) as PublicKeyCredential | null
    if (credential === null)
      return resultErrorCodedCreate(op, "Passkey registration was cancelled.", "passkeys.invalid")
    const response = credential.response as AuthenticatorAttestationResponse
    const input: PasskeyRegistrationCompleteRequest = {
      response: {
        authenticatorAttachment:
          credential.authenticatorAttachment === "cross-platform" || credential.authenticatorAttachment === "platform"
            ? credential.authenticatorAttachment
            : undefined,
        clientExtensionResults: { ...credential.getClientExtensionResults() },
        id: credential.id,
        rawId: base64UrlEncode(credential.rawId),
        response: {
          attestationObject: base64UrlEncode(response.attestationObject),
          clientDataJSON: base64UrlEncode(response.clientDataJSON),
          transports: response.getTransports?.() as ("ble" | "hybrid" | "internal" | "nfc" | "usb")[] | undefined,
        },
        type: "public-key",
      },
      token: start.token,
    }
    return resultCreate(input)
  } catch (_error) {
    return resultErrorCodedCreate(op, "Passkey registration was not completed.", "passkeys.invalid")
  }
}
