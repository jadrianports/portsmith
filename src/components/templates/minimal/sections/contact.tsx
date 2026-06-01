/**
 * Contact section (D-05 section 7) — UI-SPEC §"7. Contact". Replaces the 03-04
 * stub: the body is real, the SHARED `SectionProps` signature, the export name, and
 * the `index.tsx` wiring are UNCHANGED (frozen 03-04 contract — `index.tsx` is NOT
 * edited, no new prop). `index.tsx` already wraps this in `<ScrollReveal
 * as="section">`, so this renders the section's INNER content (no `<section>` of its
 * own).
 *
 * FORM SHELL ONLY — NO SUBMIT WIRING (D-11 / CONT-01/02/03 → Phase 6). This is the
 * real DESIGN of the contact form, but it is deliberately inert: there is NO network
 * call, NO server action, NO Turnstile verify, NO inbox write, and NO email send.
 * The "Send Message" button is a styled `type="button"` no-op (T-03-22 — the form is
 * "visibly the design," never dead-but-claimed functionality). The ONLY working
 * interaction is the public-email `mailto:` fallback. Functional submission (inbox +
 * Resend + Turnstile) lands in Phase 6.
 *
 * PUBLIC EMAIL via the content (Option A — additive field, NOT a contract change):
 * the FROZEN `SectionProps` passes this section ONLY its resolved `section` row, so
 * `data.settings.email_public` is NOT reachable here. Rather than widen the frozen
 * contract (which 03-05/06/07 depend on), the public email is surfaced INTO the
 * contact CONTENT as an OPTIONAL `email_public` field (the SAME idiom the hero uses
 * for `resume_url`): the seed copies `settings.email_public` → `contact.email_public`,
 * and this section renders the `mailto:` render-if-present. No public email ⇒ no
 * mailto element (never a dead/empty mailto). The field is additive on the
 * schemaless JSONB content — no Postgres migration (CMS-08).
 *
 * RENDER CONTRACT (UI-SPEC §7):
 *   - mono `07 / contact` label + the heading (`contact.heading`) + the subhead
 *     "Have an idea in mind? Let's talk" (`contact.subheading`).
 *   - the form SHELL: Name / Email / Message fields (magenta focus-ring on
 *     `:focus-visible` via the scoped `.tmpl-contact-field` class in theme.css) + a
 *     clearly-RESERVED Turnstile widget slot (placeholder, not wired) + the public
 *     email as a working `mailto:` + a clearly-styled but INERT "Send Message" button
 *     (magenta fill, dark-ink label `var(--bg)` = #0C0B1E in dark — never white).
 *   - the error-slot copy is authored for P6 but the shell is inert now.
 *
 * COPY: solo-individual framing ONLY (D-12/D-13 — first person, never "team").
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 * The button label is `var(--bg)` (dark ink on the magenta fill) — the UI-SPEC's
 * hard "never white on magenta" rule, AA-safe in both modes.
 */
import type { SectionProps } from './types';
import type { ContactContent } from '@/lib/validations';

/**
 * The contact content as it flows through the section contract: `ContactContent`
 * (validated at seed time) plus the OPTIONAL `email_public` the seed surfaces from
 * `settings.email_public` for the `mailto:` fallback (Option A). Optional ⇒ the
 * mailto simply hides when absent. The cast is local so the shape is explicit even
 * before `tsc` picks up the additive schema field.
 */
type ContactSectionContent = ContactContent & { email_public?: string | null };

/** A string field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Shared field-label style (mono, muted, uppercase). */
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  lineHeight: 1.4,
  color: 'var(--muted-fg)',
};

/** Shared field style (surface inset, hairline border, body type). The magenta
 *  `:focus-visible` ring comes from the scoped `.tmpl-contact-field` class. */
const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-muted)',
  border: '1px solid var(--border)',
  fontFamily: 'var(--font-body)',
  fontWeight: 400,
  fontSize: '16px',
  lineHeight: 1.6,
  color: 'var(--fg)',
};

export function Contact({ section }: SectionProps) {
  // Cast the validated JSONB content; null-guard the row + every field.
  const content = (section?.content ?? null) as ContactSectionContent | null;
  if (!content) return null;

  const heading = present(content.heading) ? content.heading : 'Get in touch';
  // The subhead is the locked D-12 copy unless the seed overrides it.
  const subheading = present(content.subheading)
    ? content.subheading
    : "Have an idea in mind? Let's talk";
  // The public-email mailto is render-if-present (Option A — sourced from
  // settings.email_public through the seed). Absent/empty ⇒ no mailto element.
  const emailPublic = present(content.email_public) ? content.email_public : null;

  return (
    <div
      id="contact"
      // `.tmpl-shell`: the shared centered max-width + horizontal gutter (theme.css).
      className="tmpl-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        paddingBlock: '64px',
      }}
    >
      {/* Mono section label `07 / contact` (cyan, per the hero precedent). */}
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 500,
          lineHeight: 1.4,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--accent-cyan)',
          margin: 0,
        }}
      >
        07 / contact
      </p>

      {/* Heading (Clash Display Heading scale, foreground — not gradient). */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(1.75rem, 4vw, 2rem)',
          lineHeight: 1.2,
          color: 'var(--fg)',
          margin: 0,
        }}
      >
        {heading}
      </h2>

      {/* Subhead — "Have an idea in mind? Let's talk" as Muted-Body. */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: 1.5,
          color: 'var(--muted-fg)',
          margin: 0,
          maxWidth: '60ch',
        }}
      >
        {subheading}
      </p>

      {/* The form SHELL — a purple-tinted elevated panel. INERT: the form has NO
          action and NO submit handler (functional submit is P6, CONT-01/02/03).
          Rendered as a plain <div>, not a posting <form>, so there is no submit
          path at all — "visibly the design," not dead-but-claimed (T-03-22). */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          maxWidth: '640px',
          padding: '24px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Name field. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="contact-name" style={labelStyle}>
            Name
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            className="tmpl-contact-field"
            style={fieldStyle}
          />
        </div>

        {/* Email field. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="contact-email" style={labelStyle}>
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="tmpl-contact-field"
            style={fieldStyle}
          />
        </div>

        {/* Message field. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="contact-message" style={labelStyle}>
            Message
          </label>
          <textarea
            id="contact-message"
            name="message"
            rows={5}
            placeholder="Tell me what you're working on."
            className="tmpl-contact-field"
            style={{ ...fieldStyle, resize: 'vertical', minHeight: '120px' }}
          />
        </div>

        {/* Reserved slot for the Turnstile widget (wired in P6 — NOT rendered/loaded
            now; this is the visible placeholder for the challenge, no script, no
            verify). A dashed hairline box clearly marks it as a reserved area. */}
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '65px',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-strong)',
            background: 'var(--surface-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--muted-fg)',
          }}
        >
          Spam check
        </div>

        {/* The INERT "Send Message" button — magenta fill, dark-ink label var(--bg)
            (NOT white). `type="button"` + no handler ⇒ a no-op; the design of the
            primary submit, wired in P6. */}
        <button
          type="button"
          aria-disabled="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'flex-start',
            minHeight: '44px',
            padding: '0 24px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'default',
            background: 'var(--accent)',
            color: 'var(--bg)',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: '16px',
            boxShadow: '0 8px 28px -12px rgba(255,45,149,0.38)',
          }}
        >
          Send Message
        </button>

        {/* Public-email fallback (render-if-present) — the ONE working interaction.
            Sourced from settings.email_public through the seed (Option A). The error
            copy authored for P6 also points here; in P3 it is the direct path. */}
        {emailPublic ? (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: 1.6,
              color: 'var(--muted-fg)',
              margin: 0,
            }}
          >
            Prefer email? Reach me directly at{' '}
            <a
              href={`mailto:${emailPublic}`}
              style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}
            >
              {emailPublic}
            </a>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}
