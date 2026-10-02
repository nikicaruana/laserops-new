/**
 * app/admin/homepage/page.tsx
 * --------------------------------------------------------------------
 * Homepage CMS. First section: the home hero (headline, subhead, reviews badge,
 * CTAs, stat tiles) read from / written to home_config. More homepage areas
 * (featured photos, reviews selection) will be added here as they move off
 * Google Sheets. Admin gating is handled by the /admin layout.
 */
import type { Metadata } from "next";
import { getHomeHeroConfig } from "@/lib/cms/home-config";
import { HomeHeroEditor } from "@/components/admin/HomeHeroEditor";

export const metadata: Metadata = { title: "Homepage" };

export default async function HomepageAdminPage() {
  const hero = await getHomeHeroConfig();

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Homepage</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Edit the hero section at the top of the public homepage. Changes are stored in Supabase and show on the live
          site within about a minute.
        </p>
      </header>

      <HomeHeroEditor initial={hero} />
    </div>
  );
}
