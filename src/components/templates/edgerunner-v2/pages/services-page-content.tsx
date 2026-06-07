'use client';
/**
 * edgerunner-v2 /services page content — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/routes/services.tsx
 *
 * STATIC (Nakamura's content, hardcoded — not CMS data).
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout/sizing/typography Tailwind classes COPIED VERBATIM from export JSX.
 *   2. Color classes -> inline style with scoped var(--token):
 *        text-neon-pink / text-neon-cyan / text-neon-purple -> var(--neon-N)
 *        text-foreground/80 -> color-mix(in oklab, var(--fg) 80%, transparent)
 *        border-neon-N/40 -> color-mix(in oklab, var(--neon-N) 40%, transparent)
 *        bg-neon-N/10 -> color-mix(in srgb, var(--neon-N) 10%, transparent)
 *        bg-card/50 -> color-mix(in srgb, var(--surface) 50%, transparent)
 *        bg-background/40 -> color-mix(in srgb, var(--bg) 40%, transparent)
 *        border-border/50 -> color-mix(in oklab, var(--border) 50%, transparent)
 *        bg-gradient-to-br from-neon-N/10 via-neon-N/20 to-transparent -> inline style
 *   3. Custom classes (font-display, font-mono-retro, text-glow-N, shadow-neon-N,
 *        text-neon-N) KEPT AS-IS (scoped in theme.css).
 *   4. framer-motion -> motion/react with initial={false} for SSR visibility.
 *   5. 'use client' required for motion/react.
 *   6. Anchor links: /{username}#contact / /{username}#projects / /{username}/blog
 */
import { motion } from 'motion/react';
import {
  Code2,
  Cable,
  Palette,
  LayoutGrid,
  Bot,
  ArrowRight,
  Check,
  DollarSign,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { NeonDivider } from '../sections/ui/neon-divider';
import type { LucideIcon } from 'lucide-react';

// ── Accent utility maps ────────────────────────────────────────────────────────

type Accent = 'pink' | 'cyan' | 'purple';

const accentTextStyle: Record<Accent, React.CSSProperties> = {
  pink:   { color: 'var(--neon-pink)',   textShadow: '0 0 8px var(--neon-pink)'   },
  cyan:   { color: 'var(--neon-cyan)',   textShadow: '0 0 8px var(--neon-cyan)'   },
  purple: { color: 'var(--neon-purple)', textShadow: '0 0 8px var(--neon-purple)' },
};

// For className usage where we need the glow class as well
const accentTextClass: Record<Accent, string> = {
  pink:   'text-neon-pink text-glow-pink',
  cyan:   'text-neon-cyan text-glow-cyan',
  purple: 'text-neon-purple text-glow-purple',
};

const accentBorderStyle: Record<Accent, React.CSSProperties> = {
  pink:   { borderColor: 'color-mix(in oklab, var(--neon-pink) 40%, transparent)'   },
  cyan:   { borderColor: 'color-mix(in oklab, var(--neon-cyan) 40%, transparent)'   },
  purple: { borderColor: 'color-mix(in oklab, var(--neon-purple) 40%, transparent)' },
};

const accentGradientStyle: Record<Accent, React.CSSProperties> = {
  pink:   { background: 'linear-gradient(135deg, color-mix(in srgb, var(--neon-pink) 30%, transparent), color-mix(in srgb, var(--neon-magenta) 20%, transparent), transparent)' },
  cyan:   { background: 'linear-gradient(135deg, color-mix(in srgb, var(--neon-cyan) 30%, transparent), color-mix(in srgb, var(--neon-purple) 20%, transparent), transparent)'  },
  purple: { background: 'linear-gradient(135deg, color-mix(in srgb, var(--neon-purple) 30%, transparent), color-mix(in srgb, var(--neon-pink) 20%, transparent), transparent)'  },
};

const accentBgStyle: Record<Accent, React.CSSProperties> = {
  pink:   { background: 'color-mix(in srgb, var(--neon-pink) 10%, transparent)',   border: '1px solid color-mix(in oklab, var(--neon-pink) 40%, transparent)',   color: 'var(--neon-pink)'   },
  cyan:   { background: 'color-mix(in srgb, var(--neon-cyan) 10%, transparent)',   border: '1px solid color-mix(in oklab, var(--neon-cyan) 40%, transparent)',   color: 'var(--neon-cyan)'   },
  purple: { background: 'color-mix(in srgb, var(--neon-purple) 10%, transparent)', border: '1px solid color-mix(in oklab, var(--neon-purple) 40%, transparent)', color: 'var(--neon-purple)' },
};

const accentButtonStyle: Record<Accent, React.CSSProperties> = {
  pink:   { borderColor: 'var(--neon-pink)',   background: 'color-mix(in srgb, var(--neon-pink) 10%, transparent)',   color: 'var(--neon-pink)'   },
  cyan:   { borderColor: 'var(--neon-cyan)',   background: 'color-mix(in srgb, var(--neon-cyan) 10%, transparent)',   color: 'var(--neon-cyan)'   },
  purple: { borderColor: 'var(--neon-purple)', background: 'color-mix(in srgb, var(--neon-purple) 10%, transparent)', color: 'var(--neon-purple)' },
};

// ── Service data ───────────────────────────────────────────────────────────────

interface Service {
  slug: string;
  title: string;
  tagline: string;
  icon: LucideIcon;
  accent: Accent;
  included: string[];
  startingAt: string;
  timeline: string;
  idealFor: string;
}

const SERVICES: Service[] = [
  {
    slug: 'full-stack',
    title: 'Full-Stack Web Development',
    tagline: 'Edge-native products, end to end.',
    icon: Code2,
    accent: 'pink',
    included: [
      'Discovery + technical architecture',
      'React / TypeScript app build',
      'Edge runtime + database setup',
      'Auth, payments, and integrations',
      'CI/CD + observability wired in',
      'Handover docs + Loom walkthroughs',
    ],
    startingAt: '$4,000',
    timeline: '4–10 weeks',
    idealFor: 'Founders shipping a new product or rebuilding a legacy stack.',
  },
  {
    slug: 'api-development',
    title: 'API Development',
    tagline: 'Typed, documented, built to scale.',
    icon: Cable,
    accent: 'cyan',
    included: [
      'REST or GraphQL API design',
      'Auth, RBAC, and rate limiting',
      'OpenAPI / GraphQL schema docs',
      'Generated type-safe SDKs',
      'Integration + load testing',
      'Deploy + monitoring setup',
    ],
    startingAt: '$3,000',
    timeline: '3–6 weeks',
    idealFor: 'Teams needing a backend their mobile or web client can trust.',
  },
  {
    slug: 'ui-ux',
    title: 'UI / UX Design',
    tagline: 'Interaction-led, motion-first design.',
    icon: Palette,
    accent: 'purple',
    included: [
      'Product discovery + flows',
      'Component-driven design system',
      'High-fidelity Figma prototypes',
      'Motion + interaction specs',
      'Accessibility audit',
      'Dev handover + tokens',
    ],
    startingAt: '$2,500',
    timeline: '2–5 weeks',
    idealFor: 'Products that feel generic and need a real visual identity.',
  },
  {
    slug: 'cms-design',
    title: 'CMS Design',
    tagline: 'Headless platforms editors actually love.',
    icon: LayoutGrid,
    accent: 'pink',
    included: [
      'Headless CMS setup (Sanity / Payload)',
      'Custom block-based editor',
      'Live preview + draft mode',
      'Role-based publishing workflow',
      'Image pipeline + CDN',
      'Editor training + docs',
    ],
    startingAt: '$3,500',
    timeline: '3–6 weeks',
    idealFor: 'Content teams stuck inside a clunky WordPress or Webflow setup.',
  },
  {
    slug: 'automation',
    title: 'Automation / Bots / Scrapers',
    tagline: 'Weird internet plumbing, productionized.',
    icon: Bot,
    accent: 'cyan',
    included: [
      'Scoping + feasibility audit',
      'Scraper / bot / agent build',
      'Queue + retry infrastructure',
      'LLM integration + guardrails',
      'Dashboard for ops visibility',
      'Maintenance runbook',
    ],
    startingAt: '$2,000',
    timeline: '2–4 weeks',
    idealFor: 'Ops teams drowning in repetitive work or one-off data hauls.',
  },
];

// ── Testimonials ───────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote:
      "Kai rebuilt our marketing site on the edge and our LCP dropped from 4.2s to 0.6s. The motion design alone tripled our trial signups.",
    name: 'Marlowe Chen',
    role: 'Head of Growth, Halftone',
    accent: 'pink' as Accent,
  },
  {
    quote:
      "Shipped a full headless CMS + editor stack in five weeks. Our content team finally stopped emailing me Word docs to publish.",
    name: 'Dev Patel',
    role: 'Founder, Cobalt Press',
    accent: 'cyan' as Accent,
  },
  {
    quote:
      "The scraper + LLM pipeline he built saves our ops team 30 hours a week. Zero downtime in six months. Wild.",
    name: 'Sasha Okonkwo',
    role: 'COO, Spindrift Analytics',
    accent: 'purple' as Accent,
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusPill({
  tone,
  label,
  pulse,
}: {
  tone: Accent;
  label: string;
  pulse?: boolean;
}) {
  const dotClass =
    tone === 'pink'
      ? 'bg-neon-pink shadow-neon-pink'
      : tone === 'cyan'
        ? 'bg-neon-cyan shadow-neon-cyan'
        : 'bg-neon-purple shadow-neon-purple';

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono-retro text-xs uppercase tracking-widest backdrop-blur"
      style={accentBgStyle[tone]}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}${pulse ? ' animate-pulse' : ''}`} />
      {label}
    </span>
  );
}

function Hero({ username }: { username: string }) {
  return (
    <section className="relative px-6 pt-36 pb-20">
      <div className="mx-auto max-w-4xl text-center">
        <motion.span
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono-retro text-sm uppercase tracking-[0.5em]"
          style={{ color: 'color-mix(in oklab, var(--neon-cyan) 80%, transparent)' }}
        >
          // services
        </motion.span>

        <motion.h1
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.6 }}
          className="mt-5 font-display text-4xl font-black uppercase leading-[1.05] tracking-wider text-neon-pink text-glow-pink sm:text-6xl md:text-7xl"
        >
          Build it. Ship it.
          <br />
          <span className="text-neon-cyan text-glow-cyan">Make it gnarly.</span>
        </motion.h1>

        <motion.p
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-base sm:text-lg"
          style={{ color: 'color-mix(in oklab, var(--fg) 80%, transparent)' }}
        >
          Full-stack engineering, design, and weird internet automation — done end-to-end.
          No agencies. No handoffs. Just one person who has shipped this before.
        </motion.p>

        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <StatusPill tone="cyan"   label="Remote worldwide"      />
          <StatusPill tone="purple" label="Edge-native"            />
          <StatusPill tone="pink"   label="2 slots open · Q3 2026" pulse />
        </motion.div>

        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href={`/${username}#contact`}
            className="group inline-flex items-center gap-3 rounded-md border px-7 py-3.5 font-mono-retro text-sm uppercase tracking-widest transition-all"
            style={accentButtonStyle.pink}
          >
            Book a call
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href={`/${username}#projects`}
            className="inline-flex items-center gap-2 rounded-md border px-7 py-3.5 font-mono-retro text-sm uppercase tracking-widest transition-all"
            style={{
              borderColor: 'color-mix(in oklab, var(--neon-cyan) 60%, transparent)',
              color: 'var(--neon-cyan)',
            }}
          >
            See projects
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function ServiceCards({ username }: { username: string }) {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-8 lg:grid-cols-2">
        {SERVICES.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.article
              key={s.slug}
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: (i % 2) * 0.08 }}
              className="group relative flex flex-col overflow-hidden rounded-2xl border backdrop-blur-xl transition-all"
              style={{
                ...accentBorderStyle[s.accent],
                background: 'color-mix(in srgb, var(--surface) 50%, transparent)',
              }}
            >
              {/* Header */}
              <div
                className="relative border-b p-6"
                style={{
                  ...accentGradientStyle[s.accent],
                  borderColor: 'color-mix(in oklab, var(--border) 50%, transparent)',
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-xl backdrop-blur"
                    style={accentBgStyle[s.accent]}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <h2
                      className={`font-display text-xl font-black uppercase tracking-wider leading-tight ${accentTextClass[s.accent]}`}
                    >
                      {s.title}
                    </h2>
                    <p
                      className="mt-1.5 text-sm"
                      style={{ color: 'color-mix(in oklab, var(--fg) 75%, transparent)' }}
                    >
                      {s.tagline}
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-6">
                <h3
                  className="font-mono-retro text-xs uppercase tracking-[0.3em]"
                  style={{ color: 'var(--muted-fg)' }}
                >
                  // what&apos;s included
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {s.included.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3"
                      style={{ color: 'color-mix(in oklab, var(--fg) 85%, transparent)' }}
                    >
                      <span
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
                        style={accentBgStyle[s.accent]}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Meta strip */}
                <div
                  className="mt-6 grid grid-cols-2 gap-3 rounded-lg border p-4"
                  style={{
                    borderColor: 'color-mix(in oklab, var(--border) 50%, transparent)',
                    background: 'color-mix(in srgb, var(--bg) 40%, transparent)',
                  }}
                >
                  <div>
                    <div
                      className="flex items-center gap-1.5 font-mono-retro text-[0.7rem] uppercase tracking-widest"
                      style={{ color: 'var(--muted-fg)' }}
                    >
                      <DollarSign className="h-3 w-3" /> Starting at
                    </div>
                    <div
                      className={`mt-1 font-display text-2xl font-bold ${accentTextClass[s.accent]}`}
                    >
                      {s.startingAt}
                    </div>
                  </div>
                  <div>
                    <div
                      className="flex items-center gap-1.5 font-mono-retro text-[0.7rem] uppercase tracking-widest"
                      style={{ color: 'var(--muted-fg)' }}
                    >
                      <Calendar className="h-3 w-3" /> Timeline
                    </div>
                    <div
                      className={`mt-1 font-display text-2xl font-bold ${accentTextClass[s.accent]}`}
                    >
                      {s.timeline}
                    </div>
                  </div>
                </div>

                <p
                  className="mt-4 text-sm"
                  style={{ color: 'color-mix(in oklab, var(--fg) 70%, transparent)' }}
                >
                  <span
                    className="font-mono-retro uppercase tracking-wider"
                    style={{ color: 'var(--muted-fg)' }}
                  >
                    Ideal for:
                  </span>{' '}
                  {s.idealFor}
                </p>

                <div
                  className="mt-6 flex items-center justify-between border-t pt-5"
                  style={{ borderColor: 'color-mix(in oklab, var(--border) 40%, transparent)' }}
                >
                  <span
                    className="font-mono-retro text-xs uppercase tracking-widest"
                    style={{ color: 'var(--muted-fg)' }}
                  >
                    No contracts · 30-day support
                  </span>
                </div>

                <a
                  href={`/${username}#contact`}
                  className="group/cta mt-4 inline-flex items-center justify-center gap-2 rounded-md border px-5 py-3 font-mono-retro text-xs uppercase tracking-widest transition-all"
                  style={accentButtonStyle[s.accent]}
                >
                  Get in touch
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-1" />
                </a>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-20">
      <div className="mb-12 flex flex-col items-center gap-3 text-center">
        <span
          className="font-mono-retro text-sm uppercase tracking-[0.4em]"
          style={{ color: 'color-mix(in oklab, var(--neon-cyan) 80%, transparent)' }}
        >
          // proof
        </span>
        <h2 className="font-display text-3xl font-bold uppercase tracking-wider text-neon-purple text-glow-purple sm:text-4xl md:text-5xl">
          What clients say
        </h2>
        <p
          className="max-w-2xl text-base sm:text-lg"
          style={{ color: 'var(--muted-fg)' }}
        >
          Real engagements, real outcomes. The kind of work that ends with someone hitting
          reply-all just to say thanks.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <motion.figure
            key={t.name}
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="flex h-full flex-col rounded-xl border backdrop-blur transition-all p-6"
            style={{
              ...accentBorderStyle[t.accent],
              background: 'color-mix(in srgb, var(--surface) 50%, transparent)',
            }}
          >
            <Sparkles className={`h-5 w-5 ${accentTextClass[t.accent]}`} aria-hidden="true" />
            <blockquote
              className="mt-4 flex-1 text-base leading-relaxed"
              style={{ color: 'color-mix(in oklab, var(--fg) 85%, transparent)' }}
            >
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption
              className="mt-6 border-t pt-4"
              style={{ borderColor: 'color-mix(in oklab, var(--border) 40%, transparent)' }}
            >
              <div
                className={`font-mono-retro text-sm uppercase tracking-wider ${accentTextClass[t.accent]}`}
              >
                {'> '}{t.name}
              </div>
              <div
                className="mt-1 font-mono-retro text-xs"
                style={{ color: 'var(--muted-fg)' }}
              >
                --role &ldquo;{t.role}&rdquo;
              </div>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}

function BottomCTA({ username }: { username: string }) {
  return (
    <section className="relative mx-auto max-w-5xl px-6 py-24">
      <motion.div
        initial={false}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        className="relative overflow-hidden rounded-2xl border p-10 text-center backdrop-blur-xl sm:p-14"
        style={{
          borderColor: 'color-mix(in oklab, var(--neon-pink) 40%, transparent)',
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--neon-pink) 10%, transparent), color-mix(in srgb, var(--neon-purple) 10%, transparent), color-mix(in srgb, var(--neon-cyan) 10%, transparent))',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at center, color-mix(in srgb, var(--neon-pink) 15%, transparent), transparent 70%)',
          }}
        />
        <div className="relative">
          <span
            className="font-mono-retro text-xs uppercase tracking-[0.4em]"
            style={{ color: 'color-mix(in oklab, var(--neon-cyan) 80%, transparent)' }}
          >
            // ready when you are
          </span>
          <h2 className="mt-4 font-display text-3xl font-black uppercase leading-tight tracking-wider text-neon-pink text-glow-pink sm:text-5xl">
            Your stack is bleeding throughput.
          </h2>
          <p
            className="mx-auto mt-5 max-w-xl text-base sm:text-lg"
            style={{ color: 'color-mix(in oklab, var(--fg) 80%, transparent)' }}
          >
            Every week of cold starts, broken builds, and 3-second hero loads is a week of
            users bouncing. Let&apos;s stop the bleeding.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href={`/${username}#contact`}
              className="group inline-flex items-center gap-3 rounded-md border px-7 py-3.5 font-mono-retro text-sm uppercase tracking-widest transition-all"
              style={accentButtonStyle.pink}
            >
              Book a call
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href={`/${username}/blog`}
              className="inline-flex items-center gap-2 rounded-md border px-7 py-3.5 font-mono-retro text-sm uppercase tracking-widest transition-all"
              style={{
                borderColor: 'color-mix(in oklab, var(--neon-cyan) 60%, transparent)',
                color: 'var(--neon-cyan)',
              }}
            >
              Read the blog
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export interface ServicesPageContentProps {
  username: string;
}

export function ServicesPageContent({ username }: ServicesPageContentProps) {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <Hero username={username} />
      <NeonDivider glyph="◆" />
      <ServiceCards username={username} />
      <NeonDivider glyph="✦" />
      <Testimonials />
      <NeonDivider glyph="◇" />
      <BottomCTA username={username} />
    </div>
  );
}
