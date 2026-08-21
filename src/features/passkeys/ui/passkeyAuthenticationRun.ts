import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { PasskeyAuthenticationCompleteRequest } from "../public/passkeyAuthenticationCompleteRequestSchema.js"
import type { PasskeyAuthenticationStartResponse } from "../public/passkeyAuthenticationStartResponseSchema.js"
import { passkeyBase64UrlDecode } from "./passkeyBase64UrlDecode.js"
import { passkeyBase64UrlEncode } from "./passkeyBase64UrlEncode.js"

/** Runs the browser WebAuthn assertion ceremony for a server-issued authentication challenge. */
export async function passkeyAuthenticationRun(start: PasskeyAuthenticationStartResponse) {
  const op = "passkeyAuthenticationRun"
  if (globalThis.navigator?.credentials === undefined)
    return resultErrorCodedCreate(op, "Passkeys are not supported by this browser.", "passkeys.invalid")

  try {
    const options = start.options
    const credential = (await navigator.credentials.get({
      publicKey: {
        allowCredentials: options.allowCredentials?.map((item) => ({
          id: passkeyBase64UrlDecode(item.id),
          transports: item.transports?.filter(
            (transport): transport is AuthenticatorTransport => transport !== "cable" && transport !== "smart-card",
          ),
          type: item.type,
        })),
        challenge: passkeyBase64UrlDecode(options.challenge),
        rpId: options.rpId,
        timeout: options.timeout,
        userVerification: options.userVerification,
      },
    })) as PublicKeyCredential | null
    if (credential === null) return resultErrorCodedCreate(op, "Passkey sign-in was cancelled.", "passkeys.invalid")
    const response = credential.response as AuthenticatorAssertionResponse
    const input: PasskeyAuthenticationCompleteRequest = {
      response: {
        authenticatorAttachment:
          credential.authenticatorAttachment === "cross-platform" || credential.authenticatorAttachment === "platform"
            ? credential.authenticatorAttachment
            : undefined,
        clientExtensionResults: { ...credential.getClientExtensionResults() },
        id: credential.id,
        rawId: passkeyBase64UrlEncode(credential.rawId),
        response: {
          authenticatorData: passkeyBase64UrlEncode(response.authenticatorData),
          clientDataJSON: passkeyBase64UrlEncode(response.clientDataJSON),
          signature: passkeyBase64UrlEncode(response.signature),
          userHandle: response.userHandle === null ? undefined : passkeyBase64UrlEncode(response.userHandle),
        },
        type: "public-key",
      },
      token: start.token,
    }
    return resultCreate(input)
  } catch (_error) {
    return resultErrorCodedCreate(op, "Passkey sign-in was not completed.", "passkeys.invalid")
  }
}
