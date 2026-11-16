# Launch checklist

Run commands from this repository with the `unjaded` Wrangler auth profile.
Do not merge the community branch until the remote prerequisites below are ready.

## Provisioning status

- Production KV namespace created; its ID is recorded in `wrangler.jsonc`.
- Remote D1 has migrations 0001 and 0002 applied.
- The 12 approved production admins are present; local test users were not copied.
- `APPS_SCRIPT_URL` and `APPS_SCRIPT_SECRET` are set on `uj-website`.
- D1 and KV bindings will attach with the first community code deploy. The old
  assets-only Worker cannot accept D1 bindings; Cloudflare requires ES module
  format, which the new `worker/index.js` provides.
- New community code has not been deployed by this provisioning step.

## Remote prerequisites

1. Confirm `npx wrangler whoami` selects the unjaded account.
2. Create image storage:
   ```sh
   npx wrangler kv namespace create IMAGE_KV
   ```
   Add the returned namespace `id` to the `IMAGE_KV` entry in `wrangler.jsonc`.
3. Apply the database migrations:
   ```sh
   npx wrangler d1 migrations apply unjaded-community --remote
   ```
4. Add the approved admins to the remote `admins` table, with lowercase emails.
   Do not copy test accounts or sessions from local D1.
5. Set only `APPS_SCRIPT_URL` and `APPS_SCRIPT_SECRET` as Worker secrets.
   Never upload the whole `.dev.vars` file: it overrides the report threshold for local testing.
   ```sh
   npx wrangler secret put APPS_SCRIPT_URL
   npx wrangler secret put APPS_SCRIPT_SECRET
   ```
   These commands create and immediately deploy a version of the existing Worker;
   they do not deploy the local community code. Confirm the current production
   deployment before running them.
6. Confirm Google OAuth permits `https://unjadedatx.com` and is available to the
   intended users, not just configured test accounts.
7. Confirm the Apps Script owner is suitable for long-term operation.
   Notifications currently depend on the account that deployed that script.

## Review and merge

- Run `npx wrangler deploy --dry-run`.
- Open a PR against `406nvi/uj-website`'s `main` branch.
- Merging to `main` triggers the existing Cloudflare build and production deploy.
- Review these intentional hosting changes: a custom 404 page and exclusion of
  repository files, credentials, migrations, backend source, and ZIP archives
  from public static assets.
- Images use KV with a 1 MB server-enforced limit and automatic browser
  compression. KV propagation and image caches can delay visibility or deletion.
- Report emails include the approved admin list in batches of at most 10.
  If a later batch fails, retrying can resend earlier successful batches.

## Production smoke test

Sign in with Google; create a post with images; edit/reorder/remove images;
like and comment; report from another account; confirm hide/show behavior and
admin access; verify email delivery when the threshold is reached; delete the
test content.

Never use real admin notifications for automated tests without approval.
