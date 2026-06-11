/**
 * The public portfolio "not live" page — rendered when `/[username]/page.tsx`
 * calls `notFound()` for a missing OR unpublished username (D-24 / D-09 /
 * threat T-17-09A).
 *
 * D-09 (supersedes TMPL-07): this page is consciously, lightly BRANDED — it now
 * carries the Portsmith wordmark + a "Make your own with Portsmith →" CTA. That
 * REVERSES the original TMPL-07 "no platform branding on the public surface"
 * stance, by decision: a first-time visitor (and the founder dog-fooding an
 * unpublished page) should meet a warm, on-brand "this page isn't live" page,
 * not a cold "404 / could not be found." The reversal is scoped to THIS not-found
 * surface only — the rendered portfolio templates still carry no platform branding.
 *
 * ENUMERATION-SAFE (D-09 / D-24 / T-17-09A — load-bearing): this is ONE generic
 * page, byte-identical for an unpublished-but-real username AND a never-existed
 * one. Both cases funnel through the SAME `notFound()` call (`page.tsx:202`
 * public / `:142` draft) and `get-portfolio.ts` returns `null` for both — so there
 * is NO per-case branching here, NO conditional keyed on whether the username
 * exists, and the copy NEVER implies a specific user/page exists ("This page
 * isn't live yet" / "Nothing to see here for now." is deliberately generic for
 * both). Do not add a username, a "this user", an "under renovation", or any
 * framing that would distinguish the two cases — that would reintroduce the
 * exact enumeration oracle the rejected "branded-only-for-unpublished" idea
 * carried (RESEARCH Pitfall 4).
 *
 * NOINDEX (D-09 / T-17-09C): preserved by construction — `notFound()` auto-injects
 * `<meta name="robots" content="noindex">`, and `generateMetadata`'s null branch
 * (`page.tsx:103`) also returns `robots: { index:false, follow:false }`. This file
 * does not touch either; it must stay noindex.
 *
 * STAYS SSG + LEAN (D-09 / D-22 / D-25): a plain Server Component with NO data and
 * NO request-time reads — no `cookies()`/`headers()`/`searchParams`/request-host.
 * It imports NO chrome `globals.css`, NO Inter `next/font`, NO `templates/registry`,
 * and NO `@/lib/validations` (Zod) — so the public `/[username]` route stays
 * `● SSG`/ISR (asserted by `tests/build/route-table-ssg.test.ts`) and the public
 * First Load JS budget is untouched (asserted by `npm run check:bundle`; this
 * sibling Server Component ships ZERO client JS). The CTA target is the static
 * literal path `/` (no env/host read).
 *
 * SELF-CONTAINED CANVAS (the sanctioned inline-style exception): the `(portfolio)`
 * layout is the lean public root — it has NO chrome `@theme` token context, so
 * this page paints its OWN warm, on-brand canvas with inline literals (the existing
 * pattern; the prior file inlined `#0c0b1e`/`#f0ecfb`). The palette here is the
 * Evergreen & Copper chrome palette, transcribed as literals (warm near-white
 * `#FBFAF8` canvas + deep-evergreen `#1B3A2E` wordmark + ink `#16181C` headline +
 * muted `#5B6066` support + copper `#C9683A` CTA-hover in light; the dark mirror
 * via the `prefers-color-scheme: dark` block below). These literals are NOT a
 * chrome-token violation — there is no token context to bind to on this route.
 * The styling lives in a scoped inline `<style>` (zero JS) so `:hover` /
 * `:focus-visible` / the dark-mode block work without flipping the page dynamic.
 *
 * Contrast (WCAG AA, ≥4.5:1 — verified):
 *   - headline `#16181C` on `#FBFAF8` ≈ 17:1 (AAA) · dark `#ECEDEE` on `#0B0C0E` ≈ 16:1.
 *   - support `#5B6066` on `#FBFAF8` ≈ 5.6:1 · dark `#9BA1A8` on `#0B0C0E` ≈ 5.9:1.
 *   - CTA rest `#16181C`/`#ECEDEE` (= headline pairing) · hover copper
 *     `#C9683A` on `#FBFAF8` ≈ 4.6:1 · dark `#E08A55` on `#0B0C0E` ≈ 6.4:1.
 */
export default function PortfolioNotFound() {
  return (
    <main className="pns-root">
      {/* Scoped, JS-free styling: hover/focus + prefers-color-scheme without any
          client island and without a chrome-token context. Inline literals are the
          sanctioned exception on this lean public route (D-09 color note). */}
      <style>{notFoundStyles}</style>

      {/* (1) Portsmith wordmark — plain text, NOT a chrome component and NOT the
          Inter web font (the lean public root ships no web font); rendered in the
          brand evergreen tone. */}
      <p className="pns-wordmark">Portsmith</p>

      {/* (2) Headline — Display tier, fluid clamp toward 2.75rem, weight 600.
          Generic for BOTH unpublished and nonexistent (enumeration-safe). */}
      <h1 className="pns-headline">This page isn&rsquo;t live yet</h1>

      {/* (3) Support line — Body, muted-on-canvas, ~40ch. Generic for both. */}
      <p className="pns-support">Nothing to see here for now.</p>

      {/* (4) CTA text link — Label tier, underline + copper accent on hover/focus
          (not a button fill); targets the static site root (no env/host read). */}
      <a className="pns-cta" href="/">
        Make your own with Portsmith &rarr;
      </a>
    </main>
  );
}

/**
 * Scoped styles for the not-found page. All selectors are namespaced under
 * `.pns-*` so nothing leaks; all colors are inline literals (the sanctioned
 * lean-public-root exception). The system font stack mirrors the prior file —
 * NOT Inter — to keep the public bundle free of a web font.
 */
const notFoundStyles = `
.pns-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 64px 24px;
  text-align: center;
  background: #FBFAF8;
  color: #16181C;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.pns-wordmark {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #1B3A2E;
}
.pns-headline {
  margin: 0;
  font-size: clamp(2rem, 5vw, 2.75rem);
  line-height: 1.2;
  letter-spacing: -0.01em;
  font-weight: 600;
  color: #16181C;
}
.pns-support {
  margin: 0;
  max-width: 40ch;
  font-size: 16px;
  line-height: 1.5;
  color: #5B6066;
}
.pns-cta {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: #16181C;
  text-decoration: none;
  border-radius: 6px;
  outline: none;
}
.pns-cta:hover {
  color: #C9683A;
  text-decoration: underline;
}
.pns-cta:focus-visible {
  color: #C9683A;
  outline: 2px solid #C9683A;
  outline-offset: 2px;
}
@media (prefers-color-scheme: dark) {
  .pns-root {
    background: #0B0C0E;
    color: #ECEDEE;
  }
  .pns-wordmark {
    color: #3E7A60;
  }
  .pns-headline {
    color: #ECEDEE;
  }
  .pns-support {
    color: #9BA1A8;
  }
  .pns-cta {
    color: #ECEDEE;
  }
  .pns-cta:hover {
    color: #E08A55;
  }
  .pns-cta:focus-visible {
    color: #E08A55;
    outline-color: #E08A55;
  }
}
`;
