# High priority audit: 2026-05-10

## Scope

- Security and production readiness.
- Sessions, cookies, route protection, blocked/suspended users.
- Environment variables and Prisma migration status.
- Dashboard, matrix and admin functional passes through local HTTP/API.
- Visual/manual browser audit status.

## Results

### Security and production

- Session cookies are `httpOnly`, `sameSite=lax`, `path=/` and become `secure` in production.
- Protected app routes are covered by `proxy.ts`.
- API routes still perform server-side session and permission checks, so route protection does not rely only on the proxy.
- Blocked accounts cannot log in and receive a clear `403` message.
- Suspended accounts can log in and `/api/auth/me` returns a warning for the UI.
- Admin endpoints require an authenticated admin.
- Admin cannot remove their own admin role, block their own admin account, or delete their own admin user.
- `AUTH_SECRET`/`NEXTAUTH_SECRET` is now required in production. The app no longer falls back to `DATABASE_URL` for session signing.
- `.env*` files are ignored by git. `git ls-files` confirmed `.env` and `.env.local` are not tracked.
- `prisma validate` passed.
- `prisma migrate status` reported 18 migrations and the database schema is up to date.

### Dashboard

- `/api/projects` returns dashboard source data for the audit user.
- `/api/notifications/preferences` GET/PATCH works.
- Manual report POST reaches the email flow and returns the expected clear `503` while Resend is in test/provider-restricted mode.
- CSV/PDF are client-side actions and still need a browser click pass for visual/download confirmation.

### Matrix

- `/api/requirements?projectId=...` returns the expected requirement source data for the audit project.
- Visual scroll/grouping behavior still needs browser confirmation at multiple viewport sizes.

### Admin

- Temporary user created for admin audit and cleaned up.
- Admin user list included the temporary user.
- Admin status changes worked: `suspended`, `blocked`, restored `active`.
- Blocked temporary user could not log in.
- Suspended temporary user could log in and received the expected warning.
- Admin deleted a temporary project owned by another user.
- Admin deleted the temporary user and related data cleanup completed.

## Remaining caveats

- Full visual browser audit remains limited because the current runtime has trouble writing into `type=email` fields.
- Playwright is not installed in the project, so this pass used local HTTP/API checks instead of automated screenshots.
- Resend production delivery still depends on verifying the real sending domain and setting the final `EMAIL_FROM`.
- Dashboard CSV/PDF downloads need a browser pass after the browser/runtime limitation is resolved or a browser automation runtime is added.
