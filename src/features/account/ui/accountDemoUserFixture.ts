import type { User } from "../../users/public/userSchema.js"

export const accountDemoUserFixture: User = {
  createdAt: 1_774_000_000_000,
  email: "avery.stone@example.com",
  emailVerified: true,
  emailVerifiedAt: 1_774_000_060_000,
  id: "019c1234-5678-7abc-8def-0123456789ab",
  phoneNumber: "+14155552671",
  phoneNumberVerifiedAt: 1_774_000_060_000,
  profile: {
    displayName: "Avery Stone",
    firstName: "Avery",
    gender: "unspecified",
    lastName: "Stone",
    nickName: "Avery",
    picture: { contentType: "image/png", url: "https://assets.example.com/avery-stone.png" },
    preferredLanguage: "en",
  },
  realmId: "019c1234-5678-7abc-8def-1123456789ab",
  state: "active",
  updatedAt: 1_774_000_060_000,
  userName: "avery.stone",
  verificationState: "verified",
}
