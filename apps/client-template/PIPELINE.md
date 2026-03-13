# RelayWeb Content Pipeline

## How Content Changes Trigger Rebuilds

This client site uses a two-path rebuild pipeline:

### Path 1 — Payload CMS Direct Edit
1. Client or agency edits content in the Payload admin panel (`/admin`)
2. Payload fires the `afterChange` hook after saving
3. Hook calls `triggerRebuild()` utility
4. Utility sends POST to `VERCEL_DEPLOY_HOOK_URL`
5. Vercel queues a new deployment
6. Site rebuilds and goes live (typically 30–90 seconds)

### Path 2 — RelayWeb Dashboard Edit
1. Client edits content in the RelayWeb platform dashboard
2. Platform calls `POST /api/relayweb/rebuild` on this site
3. Request is verified with `RELAYWEB_WEBHOOK_SECRET`
4. Route calls `VERCEL_DEPLOY_HOOK_URL`
5. Vercel queues a new deployment
6. Site rebuilds and goes live (typically 30–90 seconds)

### Path 3 — GitHub Push (Code Changes)
1. Developer pushes to `main` branch
2. GitHub Actions workflow `deploy-client-template.yml` fires
3. Workflow calls `VERCEL_DEPLOY_HOOK_URL` via the Vercel deploy hook secret
4. Vercel queues a new deployment

## Environment Variables Required

| Variable | Description |
|---|---|
| `DATABASE_URI` | Neon Postgres connection string for this client |
| `PAYLOAD_SECRET` | Random 32-character string for Payload encryption |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel deploy hook URL from project settings |
| `RELAYWEB_WEBHOOK_SECRET` | Shared secret between platform and this site |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name (relayweb-media) |

## GitHub Actions Secrets Required

| Secret | Description |
|---|---|
| `VERCEL_DEPLOY_HOOK_URL` | Same as env var above |
| `RELAYWEB_WEBHOOK_SECRET` | Same as env var above |

## Testing the Pipeline

### Test Path 1 (Payload hook)
1. Start dev server: `npm run dev -- --port 3001`
2. Go to `http://localhost:3001/admin`
3. Create or edit a page
4. Check terminal logs for: `[triggerRebuild] Rebuild triggered`

### Test Path 2 (Dashboard webhook)
```bash
curl -X POST http://localhost:3001/api/relayweb/rebuild \
  -H "Authorization: Bearer YOUR_RELAYWEB_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"source":"test","pageSlug":"home","triggeredBy":"manual-test"}'
```
Expected response: `{"success":true,"message":"Rebuild triggered"}`

### Test Path 3 (GitHub Actions)
Push any change to `apps/client-template/` on the `main` branch and check
the Actions tab in GitHub for the `Deploy Client Template` workflow run.
