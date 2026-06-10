/**
 * Unit coverage for the server-side bot-UA denylist (ANLY-01 / D-07 / OQ-4).
 *
 * `isKnownBot(ua)` is the pure substring check the `/api/page-view` route (Plan 03)
 * uses to silently drop crawler / unfurler / automation / CLI traffic (a match →
 * generic 200, NO insert). These tests PASS NOW — the utility ships in Plan 15-01
 * (Task 1). They are the source-of-truth for the denylist contract that the route
 * test (page-view-route.test.ts) leans on when it mocks `isKnownBot`.
 *
 * Pure node-env test (no DOM, no I/O) — the vitest `unit` project (`node`).
 */
import { describe, expect, it } from 'vitest';

import { BOT_UA_SUBSTRINGS, isKnownBot } from '@/lib/analytics/bot-denylist';

// One representative real-world UA per denylist *category* (the route sees raw UAs).
const BOT_UAS: ReadonlyArray<readonly [label: string, ua: string]> = [
  ['Slack unfurler', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'],
  ['headless Chrome', 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36'],
  ['python-requests CLI', 'python-requests/2.31.0'],
  ['facebook unfurler', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
  ['curl', 'curl/8.4.0'],
  ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ['LinkedIn unfurler', 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)'],
  ['Discord unfurler', 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'],
  ['AhrefsBot SEO crawler', 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'],
  ['GPTBot AI crawler', 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)'],
  ['Lighthouse audit', 'Mozilla/5.0 (Linux; ...) Chrome/120.0.0.0 Safari/537.36 Chrome-Lighthouse'],
];

// A normal interactive browser UA — must NOT be flagged.
const REAL_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

describe('isKnownBot — denylisted UAs (ANLY-01/D-07)', () => {
  it.each(BOT_UAS)('flags %s as a bot', (_label, ua) => {
    expect(isKnownBot(ua)).toBe(true);
  });

  it('matches case-insensitively (UPPERCASED bot UA still flagged)', () => {
    expect(isKnownBot('GOOGLEBOT/2.1')).toBe(true);
    expect(isKnownBot('Mozilla/5.0 PYTHON-REQUESTS/2.31')).toBe(true);
  });
});

describe('isKnownBot — non-bot inputs', () => {
  it('does NOT flag a real desktop browser UA', () => {
    expect(isKnownBot(REAL_BROWSER_UA)).toBe(false);
  });

  it('does NOT flag a real mobile Safari UA', () => {
    const mobile =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
    expect(isKnownBot(mobile)).toBe(false);
  });

  it('returns false for a null UA (ambiguous — not auto-dropped here)', () => {
    expect(isKnownBot(null)).toBe(false);
  });

  it('returns false for an empty-string UA', () => {
    expect(isKnownBot('')).toBe(false);
  });
});

describe('BOT_UA_SUBSTRINGS — single source-of-truth array', () => {
  it('is a frozen, all-lowercase, non-empty list (so match-by-lowercased-includes holds)', () => {
    expect(Object.isFrozen(BOT_UA_SUBSTRINGS)).toBe(true);
    expect(BOT_UA_SUBSTRINGS.length).toBeGreaterThan(0);
    for (const s of BOT_UA_SUBSTRINGS) {
      expect(s).toBe(s.toLowerCase());
      expect(s.length).toBeGreaterThan(0);
    }
  });

  it('every listed substring is matched by isKnownBot (no dead entries)', () => {
    for (const s of BOT_UA_SUBSTRINGS) {
      expect(isKnownBot(`prefix ${s} suffix`)).toBe(true);
    }
  });
});
