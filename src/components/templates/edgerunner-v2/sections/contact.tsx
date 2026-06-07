'use client';
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
 *   4. framer-motion → motion/react. ALL motion values VERBATIM.
 *   5. FAKE FORM REPLACED: spinning-border wrapper kept; inner replaced by
 *      <ContactForm portfolioId emailPublic /> (same wiring as edgerunner/contact.tsx).
 *   6. Direct Lines: email only (no phone/location — not in data schema).
 *   7. 'use client' required for motion/react.
 */
import { motion } from 'motion/react';
import { Mail } from 'lucide-react';

import { ContactForm } from '@/components/public/contact-form';
import type { SectionProps } from './types';
import type { ContactContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { present } from './shared';
import { SectionHeading } from './ui/section-heading';

type ContactSectionContent = ContactContent & { email_public?: string | null };

/** Additive prop from index.tsx. */
export interface ContactExtraProps {
  emailPublic?: string | null;
}

export function Contact({ section, emailPublic: emailPublicProp }: SectionProps & ContactExtraProps) {
  const content = (section?.content ?? null) as ContactSectionContent | null;
  if (!content) return null;

  const heading = present(content.heading) ? content.heading : 'Open a Channel';
  const subheading = present(content.subheading)
    ? content.subheading
    : "Got a project, a problem, or just want to talk shaders? Drop a transmission.";

  // Email: prefer prop (from settings.email_public), fallback to content field
  const emailPublic =
    (present(emailPublicProp) ? emailPublicProp : null) ??
    (present(content.email_public) ? content.email_public : null);

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
          <motion.div
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            className="holo-panel rounded-2xl p-6 shadow-neon-cyan"
          >
            <h3 className="font-display text-lg font-bold uppercase tracking-widest text-neon-cyan">
              Direct Lines
            </h3>
            <div className="mt-5 space-y-4">
              {/* Email row — only when present */}
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
          </motion.div>

          {/* RIGHT: vivid gradient panel (the panel BG IS the gradient, faithful to export).
              The ContactForm sits inside; its inputs use --surface-muted (dark/translucent)
              boxes on the bright gradient, labels/placeholders are forced readable via the
              .tmpl-contact-gradient-panel hook in theme.css. */}
          <motion.div
            initial={false}
            animate={{ opacity: 1, x: 0 }}
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
          </motion.div>
        </div>
      </div>
    </section>
  );
}
