# R2 profile pictures

## Goal

Store Authworks user profile pictures in a dedicated Cloudflare R2 bucket in Leo's account, serve them from `https://assets.authworks.contentoren.de`, import a Google/GitHub picture when a user has none, and support validated account uploads visible in profile and admin interfaces.

## Decisions

- Use bucket `contentoren-authworks` in Leo's Cloudflare account with the EEUR location hint and default jurisdiction, plus a bucket-scoped read/write credential in `.env.production`.
- Store only public asset URLs and content types in Authworks persistence; never expose R2 credentials.
- Accept JPEG, PNG, WebP, and GIF images up to 512 KiB; reject empty, malformed, mismatched, or unsupported content.
- Use immutable keys shaped as `user-pictures/{username}_{generation}_{sha256}.{extension}`, with the normalized current username at the start and the content hash at the end of the filename.
- Upload objects with `Cache-Control: public, max-age=31536000, immutable`.
- Server-mediated uploads and provider imports share one validation, hashing, and R2 storage path.
- Import a provider picture only when the Authworks profile has no picture; never overwrite an existing picture.
- Keep server outputs as thin composition and feature behavior under `src/features/users`.

## Approach

- Provision R2, custom-domain binding, and scoped credentials before configuring production.
- Add typed private R2 configuration and a lightweight native-fetch SigV4 adapter.
- Add a bounded image validator, deterministic object-key builder, and profile-picture hosting action.
- Add an authenticated profile-picture upload route/client and replace account URL entry with a file upload.
- Extract Google/GitHub picture URLs and host them after identity validation when the profile has no picture.
- Reuse persisted picture URLs in existing public profile and admin views.

## Current context

- Cloudflare account `leonardo.mora` has the existing `contentoren-authworks` bucket, bucket-scoped credentials, and active public domain `assets.authworks.contentoren.de`; no duplicate resources are needed.
- Production runtime configuration is installed in `/home/authworks/.config/authworks/authworks.env` with `authworks` ownership and mode `0600`, including all five `AUTHWORKS_R2_*` settings. The managed Authworks service has been restarted.
- The dedicated production SSO test account uses the canonical test credentials and remains pictureless after account upload/removal verification.
- The downloader honors both scalar and all-address pinned DNS lookup contracts without relaxing SSRF checks. Successful identity linking refreshes account profile state alongside linked identities.
- Production runs the pinned DNS lookup and account profile-refresh fixes. The already-linked GitHub account has its missing picture populated through the normal guarded provider import, and the image was verified in the browser.

## Tasks

- [x] 1. Provision the bucket, scoped credentials, custom domain, and `.env.production` settings.
- [x] 2. Implement and test R2 configuration, signing, image validation, hashing, naming, and immutable upload.
- [x] 3. Implement and test authenticated profile-picture upload and removal persistence.
- [x] 4. Implement and test Google/GitHub picture import without overwriting an existing picture.
- [x] 5. Update account/admin presentation for uploaded pictures and verify browser behavior.
- [x] 6. Run repository checks and production configuration verification.

## Paths

- `.env.production`
- `docs/20260826_r2_profile_pictures.md`
- `src/features/users`
- `src/features/externalIdentities`
- `src/features/account`
- `src/features/admin`
- `src/platform/configuration`
- `src/compositions`
- `test/features`
