import type { WhatsappOtpUsageResponse } from "../../whatsappOtp/public/whatsappOtpUsageResponseSchema.js"

const fixtureNow = Date.UTC(2026, 7, 21, 9, 30)
const realmId = "01900000-0000-7000-8000-000000000001"

/**
 * Plausible multi-sender quota fixture: one sender near its hourly limit, one
 * unhealthy sender, and one idle sender. Totals equal the per-sender sums, as
 * the production reader derives them from the same send log.
 */
export const adminDemoWhatsappUsageFixture: WhatsappOtpUsageResponse = {
  attempts: {
    byStatusLastDay: { blocked: 2, failed: 4, sent: 105 },
    byStatusLastHour: { blocked: 0, failed: 1, sent: 21 },
    byPurposeLastDay: { account_phone_change: 8, registration: 25, sign_in: 72 },
  },
  limits: { dailyPerSender: 100, hourlyPerSender: 20 },
  recent: [
    {
      createdAt: fixtureNow - 5 * 60_000,
      endpointId: "primary",
      purpose: "sign_in",
      realmId,
      recipientHashPrefix: "a3f9c2e1",
      sessionName: "sales-line",
      status: "sent",
    },
    {
      createdAt: fixtureNow - 22 * 60_000,
      endpointId: "secondary",
      purpose: "registration",
      realmId,
      recipientHashPrefix: "77b1d0a4",
      sessionName: "support-line",
      status: "failed",
    },
    {
      createdAt: fixtureNow - 47 * 60_000,
      endpointId: "primary",
      purpose: "account_phone_change",
      realmId,
      recipientHashPrefix: "c51e88f0",
      sessionName: "sales-line",
      status: "sent",
    },
    {
      createdAt: fixtureNow - 72 * 60_000,
      endpointId: "primary",
      purpose: "sign_in",
      realmId,
      recipientHashPrefix: "9d04b7aa",
      sessionName: null,
      status: "blocked",
    },
    {
      createdAt: fixtureNow - 185 * 60_000,
      endpointId: "secondary",
      purpose: "sign_in",
      realmId,
      recipientHashPrefix: "41ef09c3",
      sessionName: "support-line",
      status: "sent",
    },
    {
      createdAt: fixtureNow - 460 * 60_000,
      endpointId: "primary",
      purpose: "registration",
      realmId,
      recipientHashPrefix: "b8c2d5e6",
      sessionName: "sales-line",
      status: "failed",
    },
    {
      createdAt: fixtureNow - 1_260 * 60_000,
      endpointId: "primary",
      purpose: "sign_in",
      realmId,
      recipientHashPrefix: "0f7a3d9b",
      sessionName: "sales-line",
      status: "sent",
    },
  ],
  requests: { otpRequestedLastDay: 87, otpRequestedLastHour: 9 },
  senders: [
    {
      endpointId: "primary",
      healthy: true,
      remainingDay: 36,
      remainingHour: 2,
      sentLastDay: 64,
      sentLastHour: 18,
      sessionName: "sales-line",
    },
    {
      endpointId: "secondary",
      healthy: false,
      remainingDay: 59,
      remainingHour: 17,
      sentLastDay: 41,
      sentLastHour: 3,
      sessionName: "support-line",
    },
    {
      endpointId: "backup",
      healthy: true,
      remainingDay: 100,
      remainingHour: 20,
      sentLastDay: 0,
      sentLastHour: 0,
      sessionName: "backup-line",
    },
  ],
  totals: { sentLastDay: 105, sentLastHour: 21 },
}
