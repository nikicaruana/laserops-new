# Viva.com sandbox bring-up runbook

The integration is code-complete. This is the checklist for the session with the
Viva partner present, in order. Everything the code needs already exists; this
just wires the demo account to it and proves it end to end.

Provider abstraction lives in `lib/payments/`; the Viva adapter is
`lib/payments/providers/viva.ts`. Webhook: `app/api/viva/webhook/route.ts`.
Diagnostic: `GET /api/admin/viva-check` (admin only).

---

## 1. Create the Smart Checkout OAuth credentials (partner needed)

In the **demo** dashboard (`demo.vivapayments.com`):

- Settings → API Access → **Smart Checkout Credentials** → generate.
- Copy the **Client ID** and **Client Secret**.
  - `VIVA_CLIENT_ID`
  - `VIVA_CLIENT_SECRET`

These grant the OAuth2 token used to create orders.

## 2. Get the Basic-auth pair (refunds + webhook key)

- Settings → API Access → **Merchant ID** and **API Key**.
  - `VIVA_MERCHANT_ID`
  - `VIVA_API_KEY`

Used for refunds (cancel transaction) and to fetch the webhook verification key.

## 3. Create / identify the payment Source

- Sales → **Payment Sources** → create a Source for this site (or reuse one).
- Copy its **Source Code** (a 4-digit code) → `VIVA_SOURCE_CODE`.
- On that Source set the redirect URLs (Viva uses Source-level redirects, not
  per-order):
  - **Success URL:** `<site>/checkout/complete`
  - **Failure URL:** `<site>/checkout/complete` (same page is fine for the demo)
  - Viva appends `?t={transactionId}&s={orderCode}`; the page is UX-only, the
    webhook is what confirms payment.

For local testing `<site>` is your tunnel URL (see step 6), e.g.
`https://xxxx.ngrok-free.app`.

## 4. Set env + activate Viva

In `.env.local` (see `.env.example` for the block):

```
VIVA_ENV=demo
VIVA_CLIENT_ID=...
VIVA_CLIENT_SECRET=...
VIVA_MERCHANT_ID=...
VIVA_API_KEY=...
VIVA_SOURCE_CODE=...
PAYMENT_PROVIDER=viva
```

Restart the dev server so it picks up the env.

## 5. Run the self-test (no partner needed once keys are in)

Sign in as an admin, then open:

```
/api/admin/viva-check
```

Expect `{ "ok": true, ... }` with `oauth.ok = true` and `webhookKey.ok = true`.
If a step fails it names which env var is missing or what the API returned (no
secrets are ever echoed). Fix and re-run until green.

## 6. Register the webhook

The webhook must reach a public URL. For local dev, expose the port:

```bash
ngrok http 3000
```

Then in the demo dashboard: Settings → **Webhooks** → add a webhook for
**"Transaction Payment Created"** pointing at:

```
<public-url>/api/viva/webhook
```

Viva verifies it with a **GET** to that URL expecting `{ "Key": "..." }` — our
route answers that automatically (it proxies Viva's own key endpoint). If
verification fails, re-run step 5: `webhookKey.ok` must be true first.

> EventTypeId **1796** = Transaction Payment Created. The adapter only acts on
> that event and re-fetches the transaction to confirm it is paid before marking
> anything — it never trusts the unsigned POST.

## 7. One test payment (partner or test card)

- Sign up to a confirmed per-player game as a normal player, start payment
  (`POST /api/checkout/[matchId]`), and pay on the hosted Smart Checkout with a
  **Viva test card** (from Viva's docs; demo cards succeed without real funds).
- After paying you land on `/checkout/complete`; within a moment the webhook
  fires and the signup shows **paid** (check the game page / admin Signups, and
  a `payment_confirmed` notification + email).
- Repeat for a **token bundle** (`/player-portal/store`) to exercise the
  `token_bundle` webhook path (`fulfill_checkout_intent`).

## 8. Test a refund

- From admin Signups / refund on that paid signup → confirm the refund posts
  (`DELETE /api/transactions/{ref}`), and the transaction shows refunded in the
  Viva dashboard.

---

## Sandbox-validation checklist (the only items that needed live keys)

These are marked in `viva.ts`; confirm each against the sandbox during the run:

- [ ] **Order creation** `POST /checkout/v2/orders` accepts our body
      (`amount` in cents, `merchantTrns`, `sourceCode`) and returns `orderCode`.
- [ ] **Amount units on retrieve** — `GET /checkout/v2/transactions/{id}` returns
      `amount` in **major** units (euros); the adapter does `* 100` to get cents.
      Verify a €X payment records `paid_amount_eur = X` (not X/100 or X*100).
- [ ] **Webhook shape** — `EventTypeId = 1796`, `EventData.TransactionId` /
      `MerchantTrns` present; `merchantTrns` round-trips
      `"<purpose>:<matchId>:<accountId>"`.
- [ ] **statusId** — a paid transaction reports `statusId = "F"`.
- [ ] **Refund** — `DELETE /api/transactions/{id}?amount=<cents>` cancels; partial
      amount honored.
- [ ] **Redirects** — Source success/failure URLs land on `/checkout/complete`.

When all green, Viva is production-ready pending the live-account swap
(`VIVA_ENV=production` + production credentials + production webhook + Source).

## Going live later

- Swap all `VIVA_*` for the production account values, `VIVA_ENV=production`.
- Re-register the production webhook at the real domain.
- Keep `PAYMENT_PROVIDER=viva`. Any Stripe payments already captured still refund
  via Stripe automatically (`getProviderById`), so a mid-flight switch is safe.
