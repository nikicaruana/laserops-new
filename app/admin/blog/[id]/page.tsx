/**
 * app/admin/blog/[id]/page.tsx
 * --------------------------------------------------------------------
 * Edit an existing blog post.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BlogEditor, type BlogPost } from "@/components/admin/BlogEditor";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("id, slug, title, excerpt, body_md, cover_image_url, author, is_published, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const post = data as unknown as BlogPost;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <Link href="/admin/blog" className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
            ← Blog
          </Link>
          <h1 className="mt-3 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Edit post</h1>
        </div>
        {post.is_published && (
          <Link
            href={`/blog/${post.slug}`}
            target="_blank"
            className="text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft"
          >
            View live →
          </Link>
        )}
      </header>
      <BlogEditor post={post} />
    </div>
  );
}
