/**
 * Contact section (blueprint section 13) — FAITHFUL clone of the export's `Contact.tsx`: a
 * `// CONTACT` eyebrow, an oversized heading, a muted subheading, and a large mono `mailto:`
 * link with an accent ➤ + accent bottom-rule that shifts to accent on hover. The export's
 * static contact had no form; Portsmith mounts the LIVE template-agnostic `<ContactForm>`
 * island below the mailto when a portfolio id is present (never a dead form).
 *
 * DATA: `content.heading`/`content.subheading`; the public email comes from `data.settings`
 * (threaded by `index.tsx` as `emailPublic` — the SINGLE source of truth, P25 D-07/D-08).
 */
import { ContactForm } from '@/components/public/contact-form';

import type { ContactExtraProps, SectionProps } from './types';
import type { ContactContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { SectionShell, present } from './shared';

export function Contact({ section, emailPublic: emailPublicProp }: SectionProps & ContactExtraProps) {
  const content = (section?.content ?? null) as ContactContent | null;
  if (!content) return null;

  const heading = present(content.heading) ? content.heading : "Let's build something";
  const subheading = present(content.subheading) ? content.subheading : null;

  const emailPublic = present(emailPublicProp) ? emailPublicProp : null;
  const mailtoHref = emailPublic ? safeHref(`mailto:${emailPublic}`, { allowMailto: true }) : undefined;
  const portfolioId = present(section?.portfolio_id) ? section.portfolio_id : null;

  return (
    <SectionShell id="contact" channel="CH14" eyebrow="// CONTACT">
      <h2 id="contact-heading" className="text-4xl md:text-6xl font-semibold tracking-tight">
        {heading}
      </h2>
      {subheading ? (
        <p className="mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: 'var(--muted-fg)' }}>
          {subheading}
        </p>
      ) : null}

      {emailPublic && mailtoHref ? (
        <div className="mt-12">
          <a
            href={mailtoHref}
            className="bp-mailto bp-mono group inline-flex items-baseline gap-2 text-2xl md:text-4xl border-b pb-2"
            style={{ color: 'var(--fg)', borderColor: 'var(--accent)' }}
          >
            <span aria-hidden className="text-base" style={{ color: 'var(--accent-text)' }}>
              ➤
            </span>
            {emailPublic}
          </a>
        </div>
      ) : null}

      {portfolioId ? (
        <div className="mt-12 max-w-xl">
          <ContactForm portfolioId={portfolioId} emailPublic={emailPublic} />
        </div>
      ) : null}
    </SectionShell>
  );
}
