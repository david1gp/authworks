import type { MfaTotpEnrollment } from "../public/mfaTotpEnrollmentSchema.js"
import type { MfaTotpEnrollmentRow } from "../persistence/mfaTotpEnrollmentTable.js"

export function mfaTotpEnrollmentViewCreate(row: MfaTotpEnrollmentRow): MfaTotpEnrollment {
  return {
    confirmedAt: row.confirmedAt,
    id: row.id,
    label: row.label,
    status: row.status as MfaTotpEnrollment["status"],
    userId: row.userId,
  }
}
