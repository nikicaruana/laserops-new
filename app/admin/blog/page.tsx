/**
 * app/admin/blog/page.tsx
 * --------------------------------------------------------------------
 * Blog admin: list every post (published and drafts), newest first, with a
 * link to create a new one. Reads through the admin session (blog_posts admin
 * RLS lets admins see unpublished rows).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Blog" };

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export default async function AdminBlogPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("id, slug, title, is_published, published_at, updated_at")
    .order("updated_at", { ascending: false });
  const posts = data ?? [];

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Blog</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            Feature releases and news. Published posts appear on the public blog.
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="inline-block bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-opacity hover:opacity-90"
        >
          New post
        </Link>
      </header>

      {posts.length === 0 ? (
        <p className="text-text-muted">No posts yet. Create your first one.</p>
      ) : (
        <ul className="divide-y divide-border border border-border">
          {posts.map((p) => (
            <li key={p.id as string}>
              <Link
                href={`/admin/blog/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-bg-elevated"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{p.title as string}</p>
                  <p className="mt-0.5 truncate text-xs text-text-subtle">/blog/{p.slug as string}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-text-subtle">{fmtDate((p.published_at as string) ?? (p.updated_at as string))}</span>
                  {p.is_published ? (
                    <span className="rounded-none bg-emerald-500/15 px-2 py-0.5 font-bold uppercase tracking-[0.1em] text-emerald-400">
                      Live
                    </span>
                  ) : (
                    <span className="rounded-none bg-bg-elevated px-2 py-0.5 font-bold uppercase tracking-[0.1em] text-text-muted">
                      Draft
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
