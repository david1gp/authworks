import { and, eq, isNotNull } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { MailDeliveryPort } from "../../email/domain/mailDeliveryPort.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { userEmailNormalize } from "../../users/domain/userEmailNormalize.js"
import { userTable } from "../../users/persistence/userTable.js"

type AppleRelayMailDeliveryGuardCreateOptions = {
  readonly database: StorageDatabase
  readonly inner: MailDeliveryPort
}

/**
 * Wraps a mail delivery port so recipients whose Apple private-relay email is disabled
 * never receive mail: the delivery is skipped and logged instead. A recipient without
 * a flagged user row (or with an unreadable address) is delivered normally. Database
 * lookup failures fail open to delivery so transient storage errors cannot silently
 * drop authentication mail.
 */
export function appleRelayMailDeliveryGuardCreate(options: AppleRelayMailDeliveryGuardCreateOptions): MailDeliveryPort {
  return {
    async deliver(delivery): Promise<Result<void>> {
      try {
        const normalized = userEmailNormalize(delivery.to)
        if (normalized.success) {
          const flagged = options.database.db
            .select({ id: userTable.id })
            .from(userTable)
            .where(and(eq(userTable.email, normalized.data), isNotNull(userTable.appleRelayEmailDisabledAt)))
            .get()
          if (flagged !== undefined) {
            console.warn(`Apple private relay email is disabled; skipping delivery to ${delivery.to}`)
            return resultCreate(undefined)
          }
        }
      } catch (error) {
        console.error(
          `Apple private relay check failed; delivering anyway: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      return options.inner.deliver(delivery)
    },
  }
}
