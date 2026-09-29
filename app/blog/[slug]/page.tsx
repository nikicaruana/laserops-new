/**
 * app/blog/[slug]/page.tsx
 * --------------------------------------------------------------------
 * A single published blog post, rendered from its markdown body.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { cldImage } from "@/lib/cld";
import { Markdown } from "@/components/blog/Markdown";

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
}

async function getPost(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, body_md, cover_image_url, author, published_at, is_published")
    .eq("slug", slug)
    .maybeSingle();
  return data && data.is_published ? data : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `/blog/${post.slug}` },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <article>
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <Link href="/blog" className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
            ← Back to blog
          </Link>
          <p className="mt-6 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-accent">
            {fmtDate(post.published_at)}
            {post.author ? ` · ${post.author}` : ""}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>
          {post.excerpt && <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted sm:text-lg">{post.excerpt}</p>}
        </Container>
      </section>

      {post.cover_image_url && (
        <Container size="narrow" className="pt-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cldImage(post.cover_image_url, { w: 1400 })} alt="" className="w-full border border-border object-cover" />
        </Container>
      )}

      <section>
        <Container size="narrow" className="py-10 sm:py-12">
          <Markdown source={post.body_md} className="text-base sm:text-lg" />
        </Container>
      </section>

      <section className="border-t border-border">
        <Container size="narrow" className="py-10">
          <Link
            href="/blog"
            className="inline-block border border-border-strong px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent hover:text-accent"
          >
            ← More updates
          </Link>
        </Container>
      </section>
    </article>
  );
}
