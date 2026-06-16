/**
 * Contact section — bar-for-bar transcription of the VISUAL structure from
 * lovable-exports/synthwave-founder/src/components/sections/Contact.tsx,
 * with the fake form replaced by the real platform <ContactForm> island.
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout classes VERBATIM from export JSX.
 *   2. Color classes → inline style with scoped var(--token):
 *      text-neon-cyan → var(--neon-cyan)
 *      text-neon-pink → var(--neon-pink)
 *      border-neon-pink/30 → color-mix(in oklab, var(--neon-pink) 30%, transparent)
 *      border-neon-ACCENT/40 → color-mix(in oklab, var(--neon-ACCENT) 40%, transparent)
 *      bg-background/40 → color-mix(in srgb, var(--bg) 40%, transparent)
 *      text-foreground/90 → color-mix(in oklab, var(--fg) 90%, transparent)
 *   3. Custom classes (holo-panel, shadow-neon-cyan, shadow-neon-pink, font-mono-retro,
 *      font-display, text-neon-pink, text-neon-cyan) KEPT AS-IS.
 *   4. FAKE FORM REPLACED: spinning-border wrapper kept; inner replaced by
 *      <ContactForm portfolioId emailPublic /> (same wiring as edgerunner/contact.tsx).
 *   5. Direct Lines: email + phone + location rows (Phase 25 — restored 1:1 from the
 *      export's per-detail accent map Mail→pink / Phone→cyan / MapPin→purple). Each row
 *      reads settings.{email_public,phone,location} via the scoped ContactExtraProps and
 *      renders only when present (D-07/D-08). The seed-copied content.email_public
 *      fallback is REMOVED (D-07). Phone + location are plain text (no link — RESEARCH OQ-2).
 *   6. SERVER COMPONENT — no 'use client', no motion (bundle-budget; D-25 / TMPL-04).
 *      The export's panel motion was `initial={false}` + `animate` = panels render AT REST
 *      (no visible entrance); the shared `ScrollReveal` kit wrapper already reveals the
 *      section on scroll. Converting the redundant `m.div` to a plain `<div>` drops
 *      `motion/react` from First Load JS with ZERO static-render change. The real form
 *      interactivity lives in `<ContactForm>` (its own client island), preserved as-is.
 */
import { Mail, MapPin, Phone } from 'lucide-react';

import { ContactForm } from '@/components/public/contact-form';
import type { SectionProps } from './types';
import type { ContactContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { present } from './shared';
import { SectionHeading } from './ui/section-heading';

/** The validated JSONB contact content (heading/subheading) — null-guarded below. */
type ContactSectionContent = ContactContent;

/**
 * Contact-SCOPED additive props from index.tsx (Phase 25 — D-07/D-08). email/phone/location
 * are read from `data.settings` (the SINGLE source of truth); the frozen global `SectionProps`
 * is NOT widened. Socials stay in the footer for edgerunner (the export's Contact has none).
 */
export interface ContactExtraProps {
  emailPublic?: string | null;
  location?: string | null;
  phone?: string | null;
}

export function Contact({
  section,
  emailPublic: emailPublicProp,
  location: locationProp,
  phone: phoneProp,
}: SectionProps & ContactExtraProps) {
  const content = (section?.content ?? null) as ContactSectionContent | null;
  if (!content) return null;

  const heading = present(content.heading) ? content.heading : 'Open a Channel';
  const subheading = present(content.subheading)
    ? content.subheading
    : "Got a project, a problem, or just want to talk shaders? Drop a transmission.";

  // Public contact details from SETTINGS (D-07) — omit-if-absent. The seed-copied
  // content.email_public fallback is REMOVED (D-07). Phone + location are plain text
  // (NOT tel: links — RESEARCH OQ-2).
  const emailPublic = present(emailPublicProp) ? emailPublicProp : null;
  const phone = present(phoneProp) ? phoneProp : null;
  const location = present(locationProp) ? locationProp : null;

  const mailtoHref = emailPublic
    ? safeHref(`mailto:${emailPublic}`, { allowMailto: true })
    : undefined;

  return (
    <section id="contact" className="relative py-24 px-6">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          eyebrow="Contact"
          title={heading}
          description={subheading}
          accent="pink"
        />

        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          {/* LEFT: "Direct Lines" holo-panel */}
          <div
            className="holo-panel rounded-2xl p-6 shadow-neon-cyan"
          >
            <h3 className="font-display text-lg font-bold uppercase tracking-widest text-neon-cyan">
              Direct Lines
            </h3>
            <div className="mt-5 space-y-4">
              {/* Email row — only when present. Per-detail neon accent: Mail→pink (export). */}
              {emailPublic && mailtoHref ? (
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-lg text-neon-pink"
                    style={{
                      border: '1px solid color-mix(in oklab, var(--neon-pink) 40%, transparent)',
                    }}
                  >
                    <Mail className="h-4 w-4" />
                  </span>
                  <a
                    href={mailtoHref}
                    className="font-mono-retro text-base"
                    style={{
                      color: 'color-mix(in oklab, var(--fg) 90%, transparent)',
                      textDecoration: 'none',
                    }}
                  >
                    {emailPublic}
                  </a>
                </div>
              ) : null}

              {/* Phone row — only when present. Per-detail neon accent: Phone→cyan (export).
                  Plain text (NOT a tel: link — RESEARCH OQ-2). */}
              {phone ? (
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-lg text-neon-cyan"
                    style={{
                      border: '1px solid color-mix(in oklab, var(--neon-cyan) 40%, transparent)',
                    }}
                  >
                    <Phone className="h-4 w-4" />
                  </span>
                  <span
                    className="font-mono-retro text-base"
                    style={{ color: 'color-mix(in oklab, var(--fg) 90%, transparent)' }}
                  >
                    {phone}
                  </span>
                </div>
              ) : null}

              {/* Location row — only when present. Per-detail neon accent: MapPin→purple (export). */}
              {location ? (
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-lg text-neon-purple"
                    style={{
                      border: '1px solid color-mix(in oklab, var(--neon-purple) 40%, transparent)',
                    }}
                  >
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span
                    className="font-mono-retro text-base"
                    style={{ color: 'color-mix(in oklab, var(--fg) 90%, transparent)' }}
                  >
                    {location}
                  </span>
                </div>
              ) : null}
            </div>
            {/* Status line */}
            <div
              className="mt-6 rounded-lg font-mono-retro text-base text-neon-pink p-3"
              style={{
                border: '1px solid color-mix(in oklab, var(--neon-pink) 30%, transparent)',
                background: 'color-mix(in srgb, var(--bg) 40%, transparent)',
              }}
            >
              &gt; status: open to new transmissions
            </div>
          </div>

          {/* RIGHT: vivid gradient panel (the panel BG IS the gradient, faithful to export).
              The ContactForm sits inside; its inputs use --surface-muted (dark/translucent)
              boxes on the bright gradient, labels/placeholders are forced readable via the
              .tmpl-contact-gradient-panel hook in theme.css. */}
          <div
            className="tmpl-contact-gradient-panel relative rounded-2xl p-6 shadow-neon-pink"
            style={{
              background:
                'linear-gradient(135deg, var(--neon-pink), var(--neon-purple), var(--neon-cyan))',
              boxShadow:
                '0 0 48px -12px color-mix(in oklab, var(--neon-pink) 55%, transparent), 0 0 64px -20px color-mix(in oklab, var(--neon-cyan) 50%, transparent)',
            }}
          >
            {present(section?.portfolio_id) ? (
              <ContactForm portfolioId={section.portfolio_id} emailPublic={emailPublic} />
            ) : emailPublic && mailtoHref ? (
              <div className="flex flex-col gap-6">
                <p
                  className="font-mono-retro text-base"
                  style={{ color: 'var(--bg-deep)' }}
                >
                  Prefer email? Reach me directly at{' '}
                  <a href={mailtoHref} style={{ color: 'var(--bg-deep)', textDecoration: 'underline' }}>
                    {emailPublic}
                  </a>
                  .
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
