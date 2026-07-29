/**
 * app/player-portal/login/page.tsx
 * --------------------------------------------------------------------
 * Sign-in page. If already authenticated, skip straight to the portal.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { LoginForm } from "@/components/portal/LoginForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign In",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/player-portal/player-stats");

  const { error } = await searchParams;

  return (
    <Container size="narrow" className="py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-[0.12em] text-text sm:text-3xl">
            Player Portal
          </h1>
          <p className="mt-3 text-sm text-text-muted">
            Sign in to see your stats, ratings, and season standings.
          </p>
        </div>
        <LoginForm hadError={error === "auth"} />
      </div>
    </Container>
  );
}
