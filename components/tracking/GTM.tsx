import Script from "next/script";

/**
 * Google Tag Manager loader + Consent Mode v2 default state.
 *
 * Only renders if NEXT_PUBLIC_GTM_ID is set, so local development and
 * pre-launch previews stay tracker-free by default.
 *
 * Consent defaults to DENIED for everything except essential storage.
 * A consent management platform (Klaro / Cookiebot) will update these
 * values when the user makes a choice. That's wired up in a later phase.
 */
export function GTM() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  if (!gtmId) return null;

  return (
    <>
      {/* Consent Mode v2 default state — must run BEFORE GTM */}
      <Script id="consent-default" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          /* Global default: GRANT for non-EEA traffic, where opt-in isn't
             legally required. Without this, non-EEA visitors stayed denied by
             default (no tracking unless they accept) and GA4 flagged a
             "0% consent rate" misconfiguration. */
          gtag('consent', 'default', {
            ad_storage: 'granted',
            ad_user_data: 'granted',
            ad_personalization: 'granted',
            analytics_storage: 'granted',
            functionality_storage: 'granted',
            security_storage: 'granted'
          });
          /* EEA + UK override: DENY until the visitor consents (GDPR). The
             cookie banner flips these via gtag('consent','update',...). */
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            functionality_storage: 'granted',
            security_storage: 'granted',
            region: ['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GR','HR','HU','IE','IS','IT','LI','LT','LU','LV','MT','NL','NO','PL','PT','RO','SE','SI','SK'],
            wait_for_update: 500
          });
          /* Re-apply a returning visitor's saved choice BEFORE GTM evaluates
             page-view tags. Without this, the saved consent is only re-applied
             by the React CookieConsent banner AFTER hydration — by which time
             the Page View has already fired and consent-gated Custom HTML tags
             (e.g. the Meta Pixel, gated on ad_storage) have been blocked and
             won't reliably re-fire. Reading localStorage here (same key/shape
             as CookieConsent) grants consent synchronously, so the Pixel fires
             at page view for visitors who have already accepted marketing. */
          try {
            var s = localStorage.getItem('laserops_consent_v1');
            if (s) {
              var c = JSON.parse(s);
              gtag('consent', 'update', {
                analytics_storage: c.analytics ? 'granted' : 'denied',
                ad_storage: c.marketing ? 'granted' : 'denied',
                ad_user_data: c.marketing ? 'granted' : 'denied',
                ad_personalization: c.marketing ? 'granted' : 'denied'
              });
            }
          } catch (e) {}
        `}
      </Script>

      {/* GTM loader */}
      <Script id="gtm-init" strategy="afterInteractive">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${gtmId}');
        `}
      </Script>
    </>
  );
}

/**
 * Noscript fallback iframe for GTM. Place inside <body>.
 * Required for users with JS disabled to still register basic events.
 */
export function GTMNoScript() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  if (!gtmId) return null;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
