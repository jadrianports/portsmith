/**
 * Shared 11-platform brand-icon module (Phase 25 — SET-05 / D-01/D-02/D-03).
 *
 * The SINGLE source of social-icon glyphs for EVERY template (D-01 "imported never
 * re-implemented"). It folds in edgerunner-v2's hand-coded set
 * (`edgerunner-v2/sections/ui/social-icon.tsx` — github/linkedin/x/dribbble copied
 * VERBATIM) and adds 6 new bespoke brand marks (instagram, youtube, tiktok, behance,
 * facebook, threads). The path geometry is from simple-icons (CC0-1.0 public domain —
 * no attribution required); every brand mark is `viewBox="0 0 24 24"` + a single
 * filled `<path>` so `fill="currentColor"` lets each template tint via its own scoped
 * `color` token (per-template voice, D-06 — no prop change needed).
 *
 * PURE SERVER COMPONENT — NO `'use client'`, NO state, NO motion. It ships ZERO client
 * JS; the rendered SVG markup is part of the static SSG output, so `/[username]` stays
 * `● SSG` and the bundle budget is held (SET-05 #4 / D-22 / T-25-02).
 *
 * BUNDLE / ZOD GUARD (hard — RESEARCH B.2, the `_kit` zod-onto-bundle rationale): this
 * module imports ONLY `{ Globe }` from `lucide-react` + React. It MUST NOT import
 * `SOCIAL_PLATFORMS` / anything from `@/lib/validations` or `registry.ts` — that would
 * pull `z.enum` evaluation (and the whole validation barrel) onto the public bundle.
 * The 11 slug strings are hard-coded in the switch instead (kept in sync with
 * `SOCIAL_PLATFORMS` by convention, NOT by import).
 *
 * ACCESSIBILITY (D-03): every returned `<svg>` (and the Globe fallback) carries
 * `aria-hidden="true"` — the icon is decorative; the LINK wrapper in the caller owns
 * the `aria-label` (use `PLATFORM_LABELS[platform]`). `website` and any unknown slug
 * fall back to the lucide `Globe`.
 *
 * Home is `_shared/` (a NEW sibling dir, NOT `_kit/` — RESEARCH B.4): `_kit/` is the
 * curated interactive-island + theme-bootstrap barrel; this is a pure render helper.
 */
import { Globe } from 'lucide-react';

/**
 * Human-readable label per platform slug, for the caller's `aria-label` on the icon
 * link (D-03). `website` → "Website"; `x` → "X" (the current brand name). An unknown
 * slug has no entry — the caller falls back to the raw slug string.
 */
export const PLATFORM_LABELS: Record<string, string> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  x: 'X',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  dribbble: 'Dribbble',
  behance: 'Behance',
  facebook: 'Facebook',
  threads: 'Threads',
  website: 'Website',
};

/**
 * Render the brand glyph for a social platform slug. Keyed on the `platform` slug so it
 * maps the `settings.socials` array element (`{ platform, url }`) directly — no
 * label-mapping layer. Slug matching is case-insensitive. `website` + any unknown slug
 * → lucide `Globe`. Every SVG carries `aria-hidden="true"`.
 */
export function SocialIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  const p = platform.toLowerCase();

  // github / linkedin / x|twitter / dribbble: copied VERBATIM from the edgerunner-v2
  // seed (`sections/ui/social-icon.tsx`), the existing hand-coded set (D-01).
  if (p === 'github') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    );
  }
  if (p === 'linkedin') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
  }
  if (p === 'x' || p === 'twitter') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L2.25 2.25h6.865l4.264 5.635 5.865-5.635zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
      </svg>
    );
  }
  if (p === 'dribbble') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.51 0 10-4.48 10-10S17.51 2 12 2zm6.605 4.61a8.502 8.502 0 011.93 5.314c-.281-.054-3.101-.629-5.943-.271-.065-.141-.12-.293-.184-.445a25.424 25.424 0 00-.564-1.236c3.145-1.28 4.577-3.124 4.761-3.362zM12 3.475c2.17 0 4.154.813 5.662 2.148-.152.216-1.443 1.941-4.48 3.08-1.399-2.57-2.95-4.675-3.189-5A8.687 8.687 0 0112 3.475zm-3.633.803a53.896 53.896 0 013.167 4.935c-3.992 1.063-7.517 1.04-7.896 1.04a8.581 8.581 0 014.729-5.975zM3.453 12.01v-.26c.37.01 4.512.065 8.775-1.215.25.477.477.965.694 1.453-.109.033-.228.065-.336.098-4.404 1.42-6.747 5.303-6.942 5.629a8.522 8.522 0 01-2.19-5.705zM12 20.547a8.482 8.482 0 01-5.239-1.8c.152-.315 1.888-3.656 6.703-5.337.022-.01.033-.01.054-.022a35.32 35.32 0 011.823 6.475 8.4 8.4 0 01-3.341.684zm4.761-1.465c-.086-.52-.542-3.015-1.659-6.084 2.679-.423 5.022.271 5.314.369a8.468 8.468 0 01-3.655 5.715z" />
      </svg>
    );
  }

  // The 6 new bespoke marks — simple-icons (CC0-1.0), single filled <path>.
  if (p === 'instagram') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.6362.552-2.9124.056-1.2808.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.0508-1.169.2463-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.4232-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.0053 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4762 1.3816.895.4217.4188.6816.8184.9005 1.3787.1655.4218.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4226.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.0053-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0048a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0048" />
      </svg>
    );
  }
  if (p === 'youtube') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }
  if (p === 'tiktok') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    );
  }
  if (p === 'behance') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 4.4v15.2h7.7c1.4 0 2.6-.3 3.6-1 1-.7 1.5-1.8 1.5-3.2 0-.9-.2-1.6-.6-2.2-.4-.6-1-1-1.9-1.2.6-.3 1.1-.7 1.4-1.2.3-.5.5-1.1.5-1.8 0-1.3-.4-2.2-1.3-2.8-.9-.6-2.1-.9-3.7-.9H0zm15.3 1.3v1.3h6v-1.3h-6zM3.3 7h3.3c.6 0 1.1.1 1.5.4.4.3.5.7.5 1.3 0 .6-.2 1-.6 1.3-.4.3-.9.4-1.6.4H3.3V7zm15.8 1.9c-1.5 0-2.7.5-3.6 1.4-.9.9-1.4 2.2-1.4 3.7 0 1.6.4 2.8 1.3 3.7.9.9 2.1 1.3 3.7 1.3 1.3 0 2.4-.3 3.2-.9.8-.6 1.4-1.4 1.6-2.4h-2.7c-.1.4-.4.6-.7.8-.3.2-.7.3-1.2.3-.7 0-1.2-.2-1.6-.6-.4-.4-.6-1-.6-1.7h7.1c0-.1 0-.3.1-.5 0-1.6-.4-2.9-1.3-3.8-.9-.9-2-1.4-3.5-1.3l-.1-.1v.6zm-15.8 2.7h3.6c.7 0 1.2.1 1.6.4.4.3.6.8.6 1.4 0 .6-.2 1.1-.6 1.4-.4.3-.9.4-1.7.4H3.3v-3.9zm15.7-.7c.6 0 1.1.2 1.4.5.3.3.5.8.6 1.4h-4.2c.1-.6.3-1.1.7-1.4.3-.3.8-.5 1.5-.5z" />
      </svg>
    );
  }
  if (p === 'facebook') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
      </svg>
    );
  }
  if (p === 'threads') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.74-1.756-.5-.582-1.274-.876-2.3-.883h-.043c-.825 0-1.946.226-2.661 1.29L8.137 7.847c.958-1.422 2.516-2.203 4.503-2.203h.043c3.323.021 5.301 2.041 5.504 5.562.116.05.232.103.346.16 1.522.715 2.638 1.798 3.225 3.13.819 1.857.895 4.883-1.586 7.314-1.812 1.774-4.012 2.601-7.045 2.624z" />
      </svg>
    );
  }

  // website + any unknown slug → lucide Globe (stroke icon, aria-hidden — D-03).
  return <Globe size={size} aria-hidden="true" />;
}
