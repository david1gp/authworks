Create a beautiful, stunning, clean profile one page.

## `/account` example data

### Profile

- Name: Avery Stone
- Username: `avery.stone`
- Primary email: `avery.stone@example.com`
- Email status: Verified
- Secondary email: `avery.secondary@example.com`
- Secondary email status: Verification pending
- Phone: `+1 415 555 2671`
- First name: Avery
- Last name: Stone
- Display name: Avery Stone
- Nickname: Avery
- Gender: Unspecified
- Preferred language: English
- Profile picture available
- Account status: Active

### Security

- Password: Set
- Passkeys: 2
  - Laptop passkey — synced
  - Security key — device-bound
- Authenticator: Authenticator app
- Recovery codes remaining: 7
- Verified email: `avery.stone@example.com`
- Verified phone: `+1 415 555 2671`
- Security progress: 5 of 5 methods configured

### Sessions and devices

- Current session
  - Firefox on Linux
  - IP: `192.0.2.10`
  - Authentication: Password + authenticator
  - Multi-factor authentication
- Other session
  - Safari on iPhone
  - IP: `198.51.100.24`
  - Authentication: Passkey

### Connected identities

- GitHub
  - Username: `averystone`
  - Email: `avery@example.com`
- Microsoft
  - Email: `avery@northwind.example`

### Authorized applications

- Acme Dashboard
  - Status: Active
- Acme Mobile
  - Status: Revoked
- Analytics Dashboard
- Expense Mobile

### Organization access

**Northwind Labs**

- Organization ID: `northwind`
- Active organization
- Roles: Owner, Admin
- Project: Customer Portal
- Permissions:
  - Read organization
  - Switch organization
  - Read project

**Field Notes**

- Organization ID: `field-notes`
- Role: Member

### Invitation

- Organization: Northwind Labs
- Invited email: `avery@example.com`
- Role: Member
- Status: Pending

### Security history

Include recent events such as:

- Signed in with password
- Completed multi-factor authentication
- Signed in with a passkey
- Created a new session
- Linked a GitHub identity
- Verified an email address
- Revoked application access
- Administrator impersonation started

### Danger zone

- Permanently delete the account
- Require entering `avery.stone@example.com` for confirmation
- Explain that deletion removes sessions and access permanently

The design should also cover:

- Loading state
- Empty state
- Error with retry
- Expired session
- Permission denied
- Form validation
- Save success messages
- In-progress actions such as “Saving…”, “Verifying…”, and “Uploading…”
