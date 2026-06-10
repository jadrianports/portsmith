/**
 * Server-side known-bot User-Agent denylist (ANLY-01 / D-07).
 *
 * The `/api/page-view` beacon route (Plan 03) calls `isKnownBot(req.headers.get
 * ('user-agent'))`; a match → the route silently no-ops (generic 200, NO insert).
 * The JS beacon already drops non-JS crawlers for free (they never run the client
 * island); this is the belt-and-suspenders server layer that also catches the
 * social/preview unfurlers (Slack/Discord/LinkedIn/Twitter/Facebook/WhatsApp/
 * Telegram), common search + SEO + AI crawlers, headless-automation UAs, and CLI
 * HTTP clients — with NO bot-detection dependency and one O(n) `.some(includes)`
 * check (D-07: no dependency, no rate-heuristics — overkill avoided at this scale).
 *
 * Substring starter set from 15-RESEARCH.md § Open Questions OQ-4. Trim/extend this
 * SINGLE source-of-truth array to tune the denylist — never inline these strings at
 * the call site.
 *
 * BUNDLE-SPLIT GUARD (Pitfall 3 — load-bearing): this module is PURE and imports
 * NOTHING from `@/lib/validations` / `@/components/templates/registry` (both evaluate
 * `z.enum(...)` at module scope → ~63 kB zod onto the public First Load JS). It does
 * NOT touch secrets, so it needs no `import 'server-only'` and may be imported by both
 * the route and a unit test. It is logic-only: one frozen const array + one function.
 */

/**
 * Lowercased UA substrings that mark a request as a bot/crawler/unfurler/automation
 * client. Matched case-insensitively via `includes` against the lowercased UA.
 * `bot` is kept broad on purpose — it matches most well-behaved crawlers that
 * self-identify (`Googlebot`, `bingbot`, `…bot`), accepting the negligible
 * false-positive risk on an unusual product UA (D-07 / OQ-4 rationale).
 */
export const BOT_UA_SUBSTRINGS: readonly string[] = Object.freeze([
  // Generic crawler tokens (broad, self-identifying crawlers).
  'bot',
  'crawler',
  'spider',
  'crawl',
  'slurp',
  // Headless / automation engines.
  'headlesschrome',
  'phantomjs',
  'puppeteer',
  'playwright',
  // CLI / library HTTP clients (never a real interactive visitor).
  'python-requests',
  'axios',
  'curl',
  'wget',
  'go-http-client',
  'node-fetch',
  // Social / chat preview unfurlers (D-07 names these explicitly).
  'facebookexternalhit',
  'facebot',
  'slackbot',
  'slack-imgproxy',
  'discordbot',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
  'embedly',
  'redditbot',
  'pinterest',
  // Search-engine crawlers.
  'googlebot',
  'bingbot',
  'applebot',
  'yandexbot',
  'duckduckbot',
  // SEO / commercial crawlers.
  'ahrefsbot',
  'semrushbot',
  'mj12bot',
  'dotbot',
  'petalbot',
  'bytespider',
  // AI crawlers.
  'gptbot',
  'ccbot',
  'claudebot',
  'perplexitybot',
  // Auditing / synthetic.
  'lighthouse',
  'chrome-lighthouse',
]);

/**
 * Returns `true` when the User-Agent contains any denylisted substring
 * (case-insensitive), `false` for a normal browser UA or a null/empty UA.
 *
 * A null/empty UA is treated as NOT-a-known-bot (it is NOT auto-dropped here): a
 * missing UA is ambiguous, and the JS-gate + rate-limit already bound the risk. The
 * caller drops only on a positive, named match.
 */
export function isKnownBot(ua: string | null): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return BOT_UA_SUBSTRINGS.some((s) => lower.includes(s));
}
