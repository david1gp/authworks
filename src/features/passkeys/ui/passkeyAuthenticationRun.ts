import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { englishCatalog } from "../../../ui/i18n/model/englishCatalog.js"
import type { PasskeyAuthenticationCompleteRequest } from "../public/passkeyAuthenticationCompleteRequestSchema.js"
import type { PasskeyAuthenticationStartResponse } from "../public/passkeyAuthenticationStartResponseSchema.js"
import type { PasskeyAuthenticationStatus } from "../public/passkeyAuthenticationStatusSchema.js"
import { passkeyBase64UrlDecode } from "./passkeyBase64UrlDecode.js"
import { passkeyBase64UrlEncode } from "./passkeyBase64UrlEncode.js"
import { passkeyCapabilityCheck } from "./passkeyCapabilityCheck.js"
import { passkeyCeremonyErrorClassify } from "./passkeyCeremonyErrorClassify.js"

/** Runs the browser WebAuthn assertion ceremony for a server-issued authentication challenge. */
export async function passkeyAuthenticationRun(
  start: PasskeyAuthenticationStartResponse,
  options?: { readonly statusSet?: (status: PasskeyAuthenticationStatus) => void },
) {
  const op = "passkeyAuthenticationRun"
  if (!passkeyCapabilityCheck()) {
    options?.statusSet?.("unsupported")
    return resultErrorCodedCreate(op, englishCatalog["login.passkey.unsupported"], "passkeys.invalid")
  }

  try {
    const publicKeyOptions = start.options
    options?.statusSet?.("pending")
    const credential = (await navigator.credentials.get({
      publicKey: {
        allowCredentials: publicKeyOptions.allowCredentials?.map((item) => ({
          id: passkeyBase64UrlDecode(item.id),
          transports: item.transports?.filter(
            (transport): transport is AuthenticatorTransport => transport !== "cable" && transport !== "smart-card",
          ),
          type: item.type,
        })),
        challenge: passkeyBase64UrlDecode(publicKeyOptions.challenge),
        rpId: publicKeyOptions.rpId,
        timeout: publicKeyOptions.timeout,
        userVerification: publicKeyOptions.userVerification,
      },
    })) as PublicKeyCredential | null
    if (credential === null) {
      options?.statusSet?.("ceremony-failure")
      return resultErrorCodedCreate(op, englishCatalog["login.passkey.canceled"], "passkeys.invalid")
    }
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
    options?.statusSet?.("ready")
    return resultCreate(input)
  } catch (error) {
    const classified = passkeyCeremonyErrorClassify(error)
    options?.statusSet?.(classified.status)
    return resultErrorCodedCreate(op, classified.message, "passkeys.invalid")
  }
}
