import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "Contact LaserOps Malta | Laser Tag Enquiries",
  description:
    "Get in touch with LaserOps Malta. Call, WhatsApp, or email us to book a session, ask a question, or find out more about our laser tag events.",
};

// ── Contact detail card ─────────────────────────────────────────────────────

function ContactCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-bg-elevated text-accent">
        {icon}
      </div>
      <div>
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-text-muted">
          {label}
        </p>
        <div className="mt-1 text-sm leading-relaxed text-text">{children}</div>
      </div>
    </div>
  );
}

// ── Social link ─────────────────────────────────────────────────────────────

function SocialLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center border border-border bg-bg-elevated text-text-muted transition-colors hover:border-accent hover:text-accent"
    >
      {icon}
    </a>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────

const PhoneIcon = (
  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.07 1.18 2 2 0 012.06 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
  </svg>
);

const EmailIcon = (
  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const WhatsAppIcon = (
  <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const InstagramIcon = (
  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const FacebookIcon = (
  <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

// ── Page ────────────────────────────────────────────────────────────────────

export default function ContactPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20 lg:py-24">
          <span className="eyebrow">Contact</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Get in Touch
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            Questions about booking, group sizes, or anything else — drop us a
            message and we&apos;ll get back to you within 24 hours. For the
            fastest response, WhatsApp works best.
          </p>
        </Container>
      </section>

      {/* ── Contact details ──────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <ContactCard icon={PhoneIcon} label="Phone / WhatsApp">
              <a
                href="https://wa.me/35699991053"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent"
              >
                +356 9999 1053
              </a>
            </ContactCard>

            <ContactCard icon={EmailIcon} label="Email">
              <a
                href="mailto:info@laseropsmalta.com"
                className="hover:text-accent"
              >
                info@laseropsmalta.com
              </a>
            </ContactCard>

            <ContactCard icon={WhatsAppIcon} label="Community">
              <a
                href="https://chat.whatsapp.com/Duox9CiCmasKsv8tcuQScZ"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent"
              >
                Join the WhatsApp community
              </a>
              <p className="mt-1 text-xs text-text-muted">
                Open games, news, and new players welcome
              </p>
            </ContactCard>
          </div>

          {/* Social links */}
          <div className="mt-10 border-t border-border pt-8">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-text-muted">
              Follow Us
            </p>
            <div className="mt-3 flex items-center gap-3">
              <SocialLink
                href="https://www.instagram.com/laserops.mt/"
                label="LaserOps on Instagram"
                icon={InstagramIcon}
              />
              <SocialLink
                href="https://www.facebook.com/laserops.mt"
                label="LaserOps on Facebook"
                icon={FacebookIcon}
              />
            </div>
          </div>
        </Container>
      </section>

      {/* ── Contact form ─────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Send Us a Message
          </h2>
          <p className="mt-3 text-sm text-text-muted">
            For event enquiries and bookings, use the{" "}
            <a href="/booking" className="text-accent hover:underline">
              booking form
            </a>{" "}
            instead — it captures the details we need to get things set up.
          </p>
          <div className="mt-8">
            <ContactForm />
          </div>
        </Container>
      </section>
    </>
  );
}
