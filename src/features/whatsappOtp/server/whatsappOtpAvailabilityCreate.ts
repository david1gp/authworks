import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationLoginPolicyEnforce } from "../../organizations/actions/organizationLoginPolicyEnforce.js"
import type { WahaConfiguration } from "../../waha/server/wahaConfiguration.js"
import { wahaHealthCandidateReaderCreate } from "../../waha/server/wahaHealthCandidateReaderCreate.js"
import type { WhatsappOtpAvailabilityPort } from "../domain/whatsappOtpAvailabilityPort.js"
import { whatsappOtpAvailabilityPredicate } from "../domain/whatsappOtpAvailabilityPredicate.js"
import type { WhatsappOtpAvailabilityResponse } from "../public/whatsappOtpAvailabilityResponseSchema.js"

type WhatsappOtpAvailabilityCreateOptions = {
  readonly configuration?: WahaConfiguration
  readonly database: StorageDatabase
  readonly reader: ReturnType<typeof wahaHealthCandidateReaderCreate>
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now">
}

export function whatsappOtpAvailabilityCreate(
  options: WhatsappOtpAvailabilityCreateOptions,
): WhatsappOtpAvailabilityPort {
  return {
    whatsappOtpAvailabilityGet(input) {
      const op = "whatsappOtpAvailabilityGet"
      const configuration = options.configuration
      const configured = (configuration?.endpoints.length ?? 0) > 0
      if (!configured)
        return resultCreate({
          available: whatsappOtpAvailabilityPredicate({
            configured,
            freshHealthyCandidate: false,
            policyEnabled: false,
          }),
        })

      const policy = organizationLoginPolicyEnforce({
        database: options.database,
        method: "whatsapp_otp",
        organizationId: input.organizationId,
        realmId: input.realmId,
      })
      if (!policy.success) {
        if (policy.code === "organizations.login-method-disabled" || policy.code === "organizations.not-found")
          return resultCreate({ available: false })
        return resultErrorCodedCreate(op, policy.errorMessage, policy.code ?? "whatsapp-otp.internal")
      }

      const now = (options.runtime ?? runtimeCreate()).now()
      if (!Number.isSafeInteger(now) || now < 0)
        return resultErrorCodedCreate(op, "The WhatsApp OTP availability timestamp is invalid.", "whatsapp-otp.invalid")

      const candidates = options.reader.wahaHealthCandidateFreshHealthyList(now)
      if (!candidates.success)
        return resultErrorCodedCreate(
          op,
          "The WhatsApp OTP availability could not be read.",
          "whatsapp-otp.read-failed",
        )

      const configuredEndpoints = new Map((configuration?.endpoints ?? []).map((endpoint) => [endpoint.id, endpoint]))
      return resultCreate<WhatsappOtpAvailabilityResponse>({
        available: whatsappOtpAvailabilityPredicate({
          configured,
          freshHealthyCandidate: candidates.data.some((candidate) => {
            const endpoint = configuredEndpoints.get(candidate.endpointId)
            return (
              endpoint !== undefined &&
              (endpoint.senderSessions === undefined || endpoint.senderSessions.includes(candidate.sessionName))
            )
          }),
          policyEnabled: true,
        }),
      })
    },
  }
}
