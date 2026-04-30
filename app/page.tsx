import { HomeHero } from "@/components/sections/HomeHero";
import { WeaponsSection } from "@/components/sections/WeaponsSection";
import { GallerySection } from "@/components/sections/GallerySection";
import { Container } from "@/components/ui/Container";

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <WeaponsSection />
      <GallerySection />

      {/*
        Temporary placeholder for sections still to come:
          - Final CTA band before footer
      */}
      <section className="border-t border-border bg-bg-elevated">
        <Container className="py-32 text-center sm:py-48">
          <span className="eyebrow">Phase 2 — Final stretch</span>
          <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
            Ready to play?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-text-muted">
            Final CTA band coming next.
          </p>
        </Container>
      </section>
    </>
  );
}
