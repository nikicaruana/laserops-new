# LaserOps Malta

Production website for LaserOps — outdoor tactical laser tag in Malta.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Vercel

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and fill in any values
cp .env.example .env.local

# 3. Run the dev server
npm run dev
```

The site will be live at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command          | What it does                                              |
| ---------------- | --------------------------------------------------------- |
| `npm run dev`    | Local development server with hot reload                  |
| `npm run build`  | Production build                                          |
| `npm run start`  | Run the production build locally                          |
| `npm run lint`   | ESLint check                                              |
| `npm run format` | Format all files with Prettier (Tailwind classes sorted)  |

## Project Structure

```
app/                  Next.js App Router routes + global styles
components/
  layout/             Header, Footer, MobileNav
  ui/                 Reusable primitives (Button, Container, etc.)
  tracking/           GTM / consent (placeholder for now)
lib/                  Utilities, brand constants, nav config
public/
  brand/              Logo files
  images/             Match photos (added in Phase 2)
```

## Design System

Brand tokens are defined in `app/globals.css` under the `@theme` directive (Tailwind v4 native). Use semantic class names everywhere:

- `bg-bg` / `bg-bg-elevated` for surfaces
- `text-text` / `text-text-muted` / `text-text-subtle` for type
- `text-accent` / `bg-accent` for the brand yellow
- `border-border` / `border-border-strong` for HUD lines

## Tracking

The `<GTM />` component reads `NEXT_PUBLIC_GTM_ID` from env. If unset, no scripts load. Consent Mode v2 defaults are denied — to be wired up to a CMP in a later phase.

## Deployment

Project is designed for Vercel. Connect the repo, set env vars in the Vercel dashboard, and deploy.

## Roadmap

- **Phase 1 (current):** Foundation, layout, design system, holding-page hero
- **Phase 2:** Brochure pages — Game Modes, Equipment, Locations, Events, About, Contact
- **Phase 3:** Looker dashboard embeds
- **Phase 4:** Polish, SEO audit, accessibility, deploy
- **Phase 5+:** Google Sheets adapter, real booking system, player auth
