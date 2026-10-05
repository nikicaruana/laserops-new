# Viva.com production cutover runbook

One-page checklist to take Viva.com payments live. The integration is already
built and sandbox-tested; this is purely credential + console configuration.

> Secrets live in the password manager and in Vercel (Type: **Secret**). The
> local `.env.viva.production.local` is a convenience copy only (gitignored).
> **Rotate `VIVA_API_KEY` before go-live** (it was captured in a screenshot).

## Values (7)
| Var | Where in the Viva console |
|-----|---------------------------|
| `VIVA_ENV=production` | (fixed - these are production creds, not the demo sandbox) |
| `PAYMENT_PROVIDER=viva` | (fixed - makes Viva the active checkout provider) |
| `VIVA_MERCHANT_ID` | Settings -> API Access -> Access credentials (`c94f…`) |
| `VIVA_API_KEY` | Settings -> API Access -> Access credentials (secret) |
| `VIVA_CLIENT_ID` | Settings -> API Access -> Smart Checkout Credentials (Generate a pair) |
| `VIVA_CLIENT_SECRET` | same (secret, shown once) |
| `VIVA_SOURCE_CODE` | Sales -> Websites & Apps -> payment source Code = **5363** |

## Prerequisites
- Viva **account verification approved**. Before approval the account only
  processes **EUR 0.10** test transactions; full amounts unlock after approval.
- **v2 is deployed to the prod domain** `www.laseropsmalta.com`, with
  `NEXT_PUBLIC_SITE_URL=https://www.laseropsmalta.com` already set (done).
- The payment Source (5363) has, in the Viva console: domain
  `www.laseropsmalta.com`, HTTPS, integration **Redirection/Native Checkout v2**,
  and Success + Failure URL = `https://www.laseropsmalta.com/checkout/complete`.

## Steps (in order)
1. **Set the 7 env vars** on the **prod** Vercel project (Type **Secret** for
   `VIVA_API_KEY` and `VIVA_CLIENT_SECRET`; the rest can be Secret too).
2. **Redeploy prod** - env vars only apply on a fresh deploy.
3. **Register the webhook** (Settings -> API Access -> Webhooks):
   - URL: `https://www.laseropsmalta.com/api/viva/webhook`
   - Event: **Transaction Payment Created** (1796), Active.
   - It should now **Verify** (the live endpoint can answer Viva's challenge
     because the creds are set). If it still fails: confirm the env vars are set
     and the redeploy finished.
4. **Verify config**: open `https://www.laseropsmalta.com/api/admin/viva-check`
   as an admin. Expect: `env: production`, `active: true`, `oauth: ok`,
   `webhookKey: ok`, `missing: []`.
5. **Smoke test**:
   - While still in test mode: push a **EUR 0.10** payment end-to-end ->
     confirm the signup flips to **paid** (via the webhook) -> **refund** it.
   - After full approval: one small **real** booking -> paid -> refund ->
     confirm the refund lands.
6. Done - new checkouts now run through Viva.

## Safety / rollback
- To pause Viva, unset `PAYMENT_PROVIDER` (or set it to `stripe` if configured)
  and redeploy.
- **Keep staging on the demo sandbox** (`VIVA_ENV=demo` + demo creds). Never put
  production credentials on the staging project.
- "Allow refunds" must stay ticked in API Access (it is).

## Notes
- The **webhook is the source of truth** for "paid"; `/checkout/complete` is just
  the customer's return screen.
- These are **production** credentials on `vivapayments.com` in test-restricted
  mode - NOT the separate `demo.vivapayments.com` sandbox. So `VIVA_ENV=production`
  even for the EUR 0.10 test.
