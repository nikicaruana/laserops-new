# Analytics & Ads tracking — GTM / GA4 / Meta

All tracking runs through **Google Tag Manager**. The site pushes semantic
`dataLayer` events; GTM fans each one out to **GA4** and the **Meta Pixel**, and
every ads/analytics tag is **consent-gated**. Nothing here lives in the page
markup except the small `dataLayer` pushes noted below.

- **Meta Pixel ID:** `1014558194633816`
- **GA4 Measurement ID:** `G-CD2NNQ9TJR` (Google tag "LaserOps Malta")
- **GTM container:** `NEXT_PUBLIC_GTM_ID`

---

## Architecture

```
site (dataLayer.push)  →  GTM trigger  →  GA4 event tag      (gated on analytics_storage)
                                       └→ Meta Custom HTML    (gated on ad_storage)
```

- **GA4** tags respect `analytics_storage` automatically via Consent Mode — no
  per-tag setting needed.
- **Meta** tags must set **Advanced Settings → Consent Settings → Require
  additional consent → `ad_storage`** individually.

---

## Consent model (live)

- `components/tracking/GTM.tsx` sets a **region-scoped Consent Mode default**:
  granted globally (non-EEA), denied for EEA/UK (incl. `MT`) until the visitor
  opts in. It also re-applies a returning visitor's stored choice in a
  `beforeInteractive` script so the base Pixel fires at page view for people who
  already accepted.
- `components/tracking/CookieConsent.tsx` pushes
  `gtag('consent','update',{ ad_storage, ad_user_data, ad_personalization,
  analytics_storage })` on the visitor's choice, **and** pushes a
  `cookie_consent_update` dataLayer event on an *active* choice (this is the
  **"Consent Granted"** trigger) so the base Pixel fires immediately the first
  time someone accepts.

> **Rule:** the **"Consent Granted"** trigger belongs on **exactly one tag** —
> the base Meta Pixel (PageView) tag. Never add it to event tags; they fire on
> their own user-action triggers and are gated by the `ad_storage` requirement.

---

## `dataLayer` events the site emits

| Event | Params | Source |
|---|---|---|
| `booking_form_submitted` | `event_type` | `components/booking/BookingForm.tsx` (on success) |
| `booking_form_start` | `event_type` | `components/booking/BookingForm.tsx` (first field focus) |
| `cookie_consent_update` | `consent_analytics`, `consent_marketing` | `components/tracking/CookieConsent.tsx` (active choice) |
| `play_cta_click` | `cta` | `components/play/CtaTrack.tsx` (every /play CTA) |
| `engaged_session` | — | `components/tracking/EngagedSession.tsx` (site-wide) |

---

## GTM variables

- **Built-in** (Variables → Configure): `Click URL`, `Click Text`,
  `Click Element`, `Page Path`.
- **`DLV - CTA`** → Data Layer Variable, name `cta`, default `unknown`.
- **`DLV - event_type`** → Data Layer Variable, name `event_type`.

---

## Triggers

| Name | Type | Match |
|---|---|---|
| All Pages | Page View | all pages |
| History Change | History Change | built-in |
| Consent Granted | Custom Event | `cookie_consent_update` |
| Booking Form Submitted | Custom Event | `booking_form_submitted` |
| Booking Form Started | Custom Event | `booking_form_start` |
| Play Page CTA Click | Custom Event | `play_cta_click` |
| Engaged Session | Custom Event | `engaged_session` |

---

## Tags

### Base pixel

**Meta Pixel — Base + PageView** · Custom HTML · consent: `ad_storage`
```html
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','1014558194633816');
fbq('track','PageView');
</script>
```
**Triggers:** All Pages **+ Consent Granted** (the only tag with Consent Granted).

**Meta Pixel — SPA PageView** · Custom HTML · consent: `ad_storage`
```html
<script>fbq('track','PageView');</script>
```
**Trigger:** History Change (doesn't fire on initial load → no duplicate).

### 1. Booking enquiry submitted  → GA4 key event + Meta Lead
- **GA4 – Booking Form Submitted** · GA4 Event · name `generate_lead` · param
  `event_type` = `{{DLV - event_type}}` · trigger **Booking Form Submitted**.
- **Meta – Booking Form Submitted** · Custom HTML · consent `ad_storage` ·
  trigger **Booking Form Submitted**:
  ```html
  <script>fbq('track','Lead');</script>
  ```

### 2. Booking form started  → GA4 + Meta InitiateCheckout
- **GA4 – Booking Form Started** · GA4 Event · name `booking_form_start` · param
  `event_type` = `{{DLV - event_type}}` · trigger **Booking Form Started**.
- **Meta – Booking Form Started** · Custom HTML · consent `ad_storage` · trigger
  **Booking Form Started**:
  ```html
  <script>fbq('track','InitiateCheckout');</script>
  ```

### 3. /play CTA clicks  → GA4 key event + Meta custom event
Fires on **all 12** /play CTAs. The `cta` param says which one:

| Section | `cta` value |
|---|---|
| Hero | `hero_open_game`, `hero_whatsapp`, `hero_private_game` |
| Choose how you play | `open_games_section`, `private_booking_section` |
| Reviews | `google_reviews` |
| Still scouting | `scouting_outdoor_laser_tag`, `scouting_weapons`, `scouting_leaderboards`, `scouting_match_reports` |
| Final CTA | `final_open_game`, `final_private_game` |

- **GA4 – Play Page CTA Click** · GA4 Event · name `play_cta_click` · param
  `cta` = `{{DLV - CTA}}` · trigger **Play Page CTA Click**.
- **Meta – Play Page CTA Click** · Custom HTML · consent `ad_storage` · trigger
  **Play Page CTA Click**. Note the **quotes** — a Custom HTML tag drops the raw
  value in, so it must be quoted to stay valid JS:
  ```html
  <script>fbq('trackCustom','PlayCTAClick',{ cta: "{{DLV - CTA}}" });</script>
  ```

### 4. Engaged session  → GA4 key event (+ optional Meta)
Site pushes `engaged_session` once at **30s active + 2 interactions** per
session (`components/tracking/EngagedSession.tsx`; adjust the thresholds there).
- **GA4 – Engaged Session** · GA4 Event · name `engaged_session` · trigger
  **Engaged Session**.
- **Meta – Engaged Session** (optional) · Custom HTML · consent `ad_storage`:
  ```html
  <script>fbq('trackCustom','EngagedSession');</script>
  ```

### Recommended (not yet built): WhatsApp Contact — zero code
Captures DM leads. **Trigger:** Click – Just Links, `Click URL` contains `wa.me`
or `chat.whatsapp.com`. **GA4** event `whatsapp_click` (key event) + **Meta**
`<script>fbq('track','Contact');</script>` (consent `ad_storage`).

---

## GA4 Key Events
GA4 → **Admin → Key events → New key event**, add by name (can pre-register
before they fire): `generate_lead`, `play_cta_click`, `engaged_session`
(and `booking_form_start`, `whatsapp_click` if wanted).

---

## Verification
1. **GTM Preview** → accept Marketing → perform each action → confirm each tag
   fires and params (`event_type`, `cta`) carry through.
2. **GA4 DebugView** (Admin → DebugView) → events arrive.
3. **Meta Events Manager → Test Events** → `Lead`, `InitiateCheckout`,
   `PlayCTAClick`, etc. arrive.
4. Decline cookies in a fresh session → no calls to `facebook.com/tr`.
5. **Submit → Publish** the container.
