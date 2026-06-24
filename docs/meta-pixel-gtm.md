# Meta (Facebook) Pixel — GTM setup

The Meta Pixel is **not** in the site code. It is configured as tags in the
**Google Tag Manager** container (`NEXT_PUBLIC_GTM_ID`) and **gated behind the
cookie banner's Marketing consent**. This file is the version-controlled record
of that dashboard configuration.

- **Pixel ID:** `1014558194633816`
- **Consent model:** the site's `CookieConsent` component
  (`components/tracking/CookieConsent.tsx`) pushes
  `gtag('consent','update',{ ad_storage, ad_user_data, ad_personalization })`
  when the visitor toggles **Marketing**. GTM's native consent checks gate the
  Pixel tags on `ad_storage`, so no site code is required.

## Tags in GTM

### 1. Meta Pixel — Base + PageView
- **Type:** Custom HTML
- **HTML:**
  ```html
  <script>
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init','1014558194633816');
  fbq('track','PageView');
  </script>
  ```
- **Trigger:** All Pages (Page View)
- **Consent:** Tag → Consent Settings → *Require additional consent for tag to
  fire* → `ad_storage`

### 2. Meta Pixel — SPA PageView
The site is a Next.js SPA; client navigations use `history.pushState`, so the
base PageView only fires on hard loads. This tag fires PageView on in-app route
changes.
- **Type:** Custom HTML → `<script>fbq('track','PageView');</script>`
- **Trigger:** History Change (built-in)
- **Consent:** require `ad_storage` (same as above)
- History Change does **not** fire on the initial load, so there is no duplicate
  PageView.

### 3. Meta Pixel — Lead (booking conversion)
`components/booking/BookingForm.tsx` already pushes
`{ event: "booking_form_submitted", event_type }` to the dataLayer on submit.
- **Trigger:** Custom Event → event name `booking_form_submitted`
- **Tag:** Custom HTML → `<script>fbq('track','Lead');</script>`
- **Consent:** require `ad_storage`

Then **Submit → Publish** the container.

## Prerequisite (separate)
`components/tracking/GTM.tsx` currently sets the **old all-denied-global**
Consent Mode default, so `ad_storage` is denied for **every** region until the
region-scoped EEA fix is applied. Until then the Pixel won't fire for non-EEA
visitors either. Apply the region-scoped default (global grant + EEA/UK deny)
so the Pixel fires for non-EEA traffic and only gates EEA/UK.

## Verification
1. **GTM Preview** → load the site; before accepting cookies the Pixel tags
   should be **held** (not fired). Accept **Marketing** → the base tag fires.
2. **Meta Pixel Helper** (Chrome extension) → Pixel detected; PageView fires
   only after consent; navigate between pages → SPA PageView fires once per
   route change (no duplicates).
3. **Meta Events Manager → Test Events** → `PageView` arrives, and `Lead` on a
   test booking submit.
4. Decline cookies in a fresh session → no requests to `facebook.com/tr`.
