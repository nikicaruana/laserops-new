/**
 * app/admin/blog/new/page.tsx
 * --------------------------------------------------------------------
 * Create a new blog post.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { BlogEditor } from "@/components/admin/BlogEditor";

export const metadata: Metadata = { title: "New post" };

export default function NewBlogPostPage() {
  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <Link href="/admin/blog" className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Blog
        </Link>
        <h1 className="mt-3 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">New post</h1>
      </header>
      <BlogEditor />
    </div>
  );
}
