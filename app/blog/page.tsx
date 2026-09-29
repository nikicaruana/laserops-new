/**
 * app/blog/page.tsx
 * --------------------------------------------------------------------
 * Public blog: feature releases + news. Lists published posts (newest first),
 * read from blog_posts (public-read where published). Managed in /admin/blog.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { cldImage } from "@/lib/cld";

export const metadata: Metadata = {
  title: "Blog",
  alternates: { canonical: "/blog" },
  description: "News and feature releases from LaserOps Malta. What is new, what is changing, and what is coming next.",
};

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
}

export default async function BlogPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, cover_image_url, author, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });
  const posts = data ?? [];

  return (
    <>
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20">
          <span className="eyebrow">Blog</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            News &amp; updates
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted sm:text-lg">
            New features, changes, and what we are working on next at LaserOps Malta.
          </p>
        </Container>
      </section>

      <section className="portal-surface">
        <Container size="wide" className="py-12 sm:py-16">
          {posts.length === 0 ? (
            <p className="text-text-muted">No posts yet. Check back soon.</p>
          ) : (
            <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group flex flex-col overflow-hidden border border-border bg-bg-elevated transition-colors hover:border-accent"
                >
                  {p.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cldImage(p.cover_image_url, { w: 800 })}
                      alt=""
                      className="aspect-[16/9] w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-[16/9] w-full bg-gradient-to-br from-accent/15 to-transparent" aria-hidden />
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-text-subtle">
                      {fmtDate(p.published_at)}
                    </p>
                    <h2 className="mt-2 text-base font-bold uppercase tracking-[0.04em] text-text group-hover:text-accent">
                      {p.title}
                    </h2>
                    {p.excerpt && <p className="mt-2 line-clamp-3 text-sm text-text-muted">{p.excerpt}</p>}
                    <span className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-accent">Read more →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
