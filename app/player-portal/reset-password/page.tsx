/**
 * app/player-portal/reset-password/page.tsx
 * --------------------------------------------------------------------
 * Landing page for the emailed password-reset link. The link goes through
 * /auth/callback (which sets a recovery session), then here to set a new
 * password.
 */
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ResetPasswordForm } from "@/components/portal/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password",
};

export default function ResetPasswordPage() {
  return (
    <Container size="narrow" className="py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="mb-8 text-center text-2xl font-bold uppercase tracking-[0.12em] text-text sm:text-3xl">
          Reset Password
        </h1>
        <ResetPasswordForm />
      </div>
    </Container>
  );
}
