"use client";

/**
 * components/admin/BlogEditor.tsx
 * --------------------------------------------------------------------
 * Create or edit a blog post. Title, slug (auto-filled from the title), excerpt,
 * cover image, author, a markdown body, and a published toggle. Images upload to
 * Cloudinary through /api/admin/image: the cover via AdminImageUploader, and body
 * images via the "Insert image" button, which drops an `![](url)` at the caret.
 * Writes with the admin session (blog_posts admin RLS). Publishing stamps
 * published_at.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AdminImageUploader } from "@/components/admin/AdminImageUploader";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  cover_image_url: string | null;
  author: string | null;
  is_published: boolean;
  published_at: string | null;
};

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function BlogEditor({ post }: { post?: BlogPost }) {
  const router = useRouter();
  const supabase = createClient();
  const isNew = !post;

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugDirty, setSlugDirty] = useState(Boolean(post?.slug));
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [cover, setCover] = useState(post?.cover_image_url ?? "");
  const [author, setAuthor] = useState(post?.author ?? "LaserOps");
  const [body, setBody] = useState(post?.body_md ?? "");
  const [published, setPublished] = useState(post?.is_published ?? false);
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const effectiveSlug = slugDirty && slug ? slugify(slug) : slugify(title);

  // Insert a snippet at the caret in the body textarea (falls back to appending).
  function insertIntoBody(snippet: string) {
    const ta = bodyRef.current;
    if (!ta) {
      setBody((b) => b + snippet);
      return;
    }
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    const next = body.slice(0, start) + snippet + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + snippet.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  // Upload one image file to Cloudinary and drop an image block into the body.
  async function uploadAndInsert(file: File) {
    setMsg(null);
    if (!file.type.startsWith("image/")) {
      setMsg({ ok: false, text: "Please choose an image file." });
      return;
    }
    setImgBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "blog");
      const res = await fetch("/api/admin/image", { method: "POST", body: form });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) throw new Error(data.error || "Upload failed.");
      insertIntoBody(`\n\n![](${data.url})\n\n`);
      setMsg({ ok: true, text: "Image inserted. Type a caption between the [ ] if you want one shown under it." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setImgBusy(false);
    }
  }

  async function onPickBodyImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadAndInsert(file);
    if (imgInputRef.current) imgInputRef.current.value = "";
  }

  // Paste a screenshot straight from the clipboard (Win+Shift+S then Ctrl+V).
  async function onPasteBody(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (!file) return; // let normal text paste happen
    e.preventDefault();
    await uploadAndInsert(file);
  }

  async function save() {
    setMsg(null);
    if (!title.trim()) return setMsg({ ok: false, text: "A title is required." });
    if (!effectiveSlug) return setMsg({ ok: false, text: "Add a title or slug." });
    setBusy(true);

    const row = {
      slug: effectiveSlug,
      title: title.trim(),
      excerpt: excerpt.trim() || null,
      cover_image_url: cover.trim() || null,
      author: author.trim() || null,
      body_md: body,
      is_published: published,
      // Stamp published_at the first time it goes live; keep it once set.
      published_at: published ? post?.published_at ?? new Date().toISOString() : post?.published_at ?? null,
    };

    if (isNew) {
      const { data, error } = await supabase.from("blog_posts").insert(row).select("id").maybeSingle();
      setBusy(false);
      if (error) return setMsg({ ok: false, text: error.message });
      router.push(`/admin/blog/${data?.id}`);
      router.refresh();
    } else {
      const { error } = await supabase.from("blog_posts").update(row).eq("id", post!.id);
      setBusy(false);
      if (error) return setMsg({ ok: false, text: error.message });
      setMsg({ ok: true, text: "Saved." });
      router.refresh();
    }
  }

  async function remove() {
    if (!post || !window.confirm("Delete this post permanently?")) return;
    setBusy(true);
    const { error } = await supabase.from("blog_posts").delete().eq("id", post.id);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    router.push("/admin/blog");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Title</label>
          <input
            className={input}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugDirty) setSlug(slugify(e.target.value));
            }}
            placeholder="What is new in the V2 rebuild"
          />
        </div>
        <div>
          <label className={labelCls}>Slug (URL)</label>
          <input
            className={input}
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugDirty(true);
            }}
            placeholder="whats-new"
          />
          <p className="mt-1 text-[0.65rem] text-text-subtle">/blog/{effectiveSlug || "…"}</p>
        </div>
      </div>

      <div>
        <label className={labelCls}>Excerpt (short summary for the list + previews)</label>
        <input className={input} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="One or two sentences." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Cover image (shown on the list + top of the post)</label>
          <AdminImageUploader value={cover || null} onChange={setCover} kind="blog" previewClass="h-20 w-36" expandable />
        </div>
        <div>
          <label className={labelCls}>Author</label>
          <input className={input} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="LaserOps" />
        </div>
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <label className={labelCls + " mb-0"}>Body</label>
          <input ref={imgInputRef} type="file" accept="image/*" onChange={onPickBodyImage} className="hidden" />
          <Button type="button" variant="secondary" size="sm" onClick={() => imgInputRef.current?.click()} disabled={imgBusy}>
            {imgBusy ? "Uploading…" : "Insert image"}
          </Button>
        </div>
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={onPasteBody}
          rows={20}
          className="w-full rounded-none border border-border-strong bg-bg-elevated p-3 font-mono text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
          placeholder={"Write in markdown.\n\n## A heading\n\nA paragraph.\n\n- A bullet\n- Another bullet\n\n**bold**, *italic*, and [a link](https://…).\n\nUse the Insert image button to add a screenshot where the cursor is."}
        />
        <p className="mt-1 text-[0.65rem] text-text-subtle">
          Supports ## and ### headings, - bullet lists, blank-line paragraphs, images, and inline **bold**, *italic* and [links](url).
          Click where you want a picture, then Insert image, or just paste a screenshot straight in (Win+Shift+S, then Ctrl+V).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-5">
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
          Published (visible on the site)
        </label>
        <Button variant="primary" size="md" onClick={save} disabled={busy}>
          {busy ? "Saving…" : isNew ? "Create post" : "Save"}
        </Button>
        {!isNew && (
          <button type="button" onClick={remove} disabled={busy} className="px-3 text-xs font-semibold uppercase tracking-[0.1em] text-red-400 hover:text-red-300 disabled:opacity-50">
            Delete
          </button>
        )}
        {msg && <span className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
