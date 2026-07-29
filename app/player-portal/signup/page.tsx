/**
 * app/player-portal/signup/page.tsx
 * --------------------------------------------------------------------
 * Dedicated account-creation page. If already signed in, skip to the portal.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { SignupForm } from "@/components/portal/SignupForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Create Account",
};

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/player-portal");

  return (
    <Container size="narrow" className="py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-[0.12em] text-text sm:text-3xl">
            Create your account
          </h1>
          <p className="mt-3 text-sm text-text-muted">
            Join the LaserOps player portal to track your stats, ratings, and season standings.
          </p>
        </div>
        <SignupForm />
      </div>
    </Container>
  );
}
