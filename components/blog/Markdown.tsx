/**
 * components/blog/Markdown.tsx
 * --------------------------------------------------------------------
 * A tiny, safe Markdown renderer for blog posts. Supports a deliberate subset:
 * "##"/"###" headings, "-" bullet lists, blank-line paragraphs, and inline
 * **bold**, *italic* and [text](url) links. Renders React elements only (no
 * HTML injection), so post bodies are safe to store as plain text.
 */
import type { ReactNode } from "react";

const INLINE = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)]+)\))/;

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (rest.length) {
    const m = rest.match(INLINE);
    if (!m || m.index == null) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    if (m[1]) out.push(<strong key={`${keyBase}-${i++}`}>{m[2]}</strong>);
    else if (m[3]) out.push(<em key={`${keyBase}-${i++}`}>{m[4]}</em>);
    else if (m[5]) {
      const href = m[7];
      const safe = /^(https?:\/\/|\/|mailto:)/.test(href) ? href : "#";
      out.push(
        <a key={`${keyBase}-${i++}`} href={safe} className="text-accent underline hover:text-accent-soft">
          {m[6]}
        </a>,
      );
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = source
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.startsWith("### ")) {
          return (
            <h3 key={i} className="mt-8 text-base font-bold uppercase tracking-[0.06em] text-text sm:text-lg">
              {inline(block.slice(4), `h3-${i}`)}
            </h3>
          );
        }
        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="mt-10 text-xl font-extrabold uppercase tracking-tight text-text sm:text-2xl">
              {inline(block.slice(3), `h2-${i}`)}
            </h2>
          );
        }
        if (block.startsWith("# ")) {
          return (
            <h2 key={i} className="mt-10 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
              {inline(block.slice(2), `h1-${i}`)}
            </h2>
          );
        }
        const img = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (img) {
          const alt = img[1];
          const src = img[2];
          return (
            <figure key={i} className="my-8 flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt} loading="lazy" className="mx-auto h-auto max-w-full border border-border" />
              {alt ? <figcaption className="mt-2 text-center text-xs text-text-subtle">{alt}</figcaption> : null}
            </figure>
          );
        }
        const lines = block.split("\n");
        if (lines.length > 0 && lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="mt-4 list-disc space-y-2 pl-5 text-text-muted">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.slice(2), `li-${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="mt-4 leading-relaxed text-text-muted">
            {inline(block.replace(/\n/g, " "), `p-${i}`)}
          </p>
        );
      })}
    </div>
  );
}
