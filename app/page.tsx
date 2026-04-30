import { HomeHero } from "@/components/sections/HomeHero";
import { WeaponsSection } from "@/components/sections/WeaponsSection";
import { Container } from "@/components/ui/Container";

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <WeaponsSection />

      {/*
        Temporary placeholder for sections still to come:
          - Game Modes (next)
          - Gallery
          - Final CTA band
      */}
      <section className="border-t border-border bg-bg-elevated">
        <Container className="py-32 text-center sm:py-48">
          <span className="eyebrow">Phase 2 — In Progress</span>
          <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
            Game Modes & Gallery incoming
          </h2>
          <p className="mx-auto mt-4 max-w-md text-text-muted">
            Game modes and gallery sections will land in the next sessions.
          </p>
        </Container>
      </section>
    </>
  );
}
