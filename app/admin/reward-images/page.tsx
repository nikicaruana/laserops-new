/**
 * app/admin/reward-images/page.tsx
 * --------------------------------------------------------------------
 * Admin: upload the game-token + XP-boost reward artwork.
 */
import { createClient } from "@/lib/supabase/server";
import { RewardImagesEditor, type RewardImage } from "@/components/admin/RewardImagesEditor";

export const metadata = { title: "Reward images" };

export default async function RewardImagesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reward_images")
    .select("key, label, image_url")
    .order("sort_order");

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Reward images</h1>
        <p className="mt-2 text-sm text-text-muted">
          Artwork for game tokens and XP boosts, reused across the app and in emails. The game-token image fills the{" "}
          <code className="text-text-subtle">{"{{tokenImageUrl}}"}</code> email token.
        </p>
      </header>
      <RewardImagesEditor initial={(data ?? []) as RewardImage[]} />
    </div>
  );
}
