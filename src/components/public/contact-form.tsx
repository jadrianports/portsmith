'use client';

/**
 * ContactForm — the live `'use client'` island that wires the inert `contact.tsx`
 * shell into a real submit (Surface 1, CONT-01/03 / D-05). The section stays a
 * Server Component with the FROZEN `SectionProps = { section }`; it passes
 * `section.portfolio_id` (present on the `public_sections` row) into this island —
 * NO contract widening (RESEARCH Open-Q1 / Pitfall 3).
 *
 * It POSTs `{ portfolio_id, sender_name, sender_email, subject?, body,
 * turnstile_token }` (the `contactFormSchema` shape) to `/api/contact` — the sole
 * service-role writer. The client validation/parse is UX only; the server re-parse
 * is the real gate (D-02).
 *
 * The five states (UI-SPEC Surface 1):
 *   idle        — interactive form; submit disabled until Turnstile is solved.
 *   submitting  — button keeps the MAGENTA fill, label "Sending…", spinner in
 *                 `var(--bg)` ink, `aria-busy`, fields disabled.
 *   success     — the form body is replaced by the decided confirmation inside an
 *                 `aria-live="polite"` region with a magenta→success glow pulse
 *                 (`.tmpl-contact-success-pulse`; reduced-motion: appears in place).
 *   error       — generic failure in `--destructive` on the panel (`role="alert"`),
 *                 IDENTICAL for 400/429/500 (never branch on 429 — D-04); a failed
 *                 submit bumps `resetSignal` so a fresh Turnstile token mints
 *                 (Pitfall 5).
 *   turnstile   — `resetSignal` bump re-disables submit until re-solved.
 *
 * Two-layer isolation (D-17): TEMPLATE tokens ONLY — inline `style` reads scoped
 * `var(--token)` and reuses the shipped `.tmpl-contact-field` / `fieldStyle` /
 * `labelStyle` so the live form is pixel-identical to the locked 03 design. NO
 * `globals.css` / chrome `ui/*` classes here. (The reused `TurnstileWidget` carries
 * its own shared infra — that is sanctioned shared challenge plumbing, not chrome.)
 *
 * Turnstile DEFER (08-03, D-11 Lighthouse gate): the `TurnstileWidget` mounts the
 * `@marsidev/react-turnstile` script (`injectScript` defaults true) the instant it
 * renders, which preloads `challenges.cloudflare.com` and inflates mobile TBT on the
 * public first-paint. So the widget is NOT rendered on hydration — it is ARMED (then
 * mounted into the reserved 65px slot) only when the form nears the viewport
 * (`IntersectionObserver`, `rootMargin:'200px'`) OR on the form's first focus /
 * pointer-down (belt-and-suspenders for a user who tabs/clicks straight in). The
 * reserved slot keeps `minHeight:65px` whether armed or not, so CLS stays 0; the
 * widget arms well before a human can fill three fields, so the `canSubmit` /
 * `turnstile_token` contract is untouched. Server siteverify (D-02/D-05) is unchanged.
 */
import { useEffect, useRef, useState } from 'react';

import dynamic from 'next/dynamic';

import { safeHref } from '@/lib/safe-url';

// Lazily-loaded — `@marsidev/react-turnstile` is ~30 kB gz and, statically imported, it
// rode into the `/[username]` route's SHARED first-load chunk (this form is a client
// component referenced by every template's contact section). It only ever renders once
// `armed` (viewport/focus-armed below), so a `next/dynamic` import keeps the widget OUT
// of first load until then — the reclaim that let the 5th template (`atelier`) fit under
// the ≤200 kB invariant (36-04 / D-22/D-25). `ssr: false` is correct (client-only widget,
// never in the SSG HTML). `npm run check:bundle` is the regression catch.
const TurnstileWidget = dynamic(
  () => import('@/components/auth/turnstile-widget').then((m) => m.TurnstileWidget),
  { ssr: false },
);

/** Shared field-label style (mono, muted, uppercase) — verbatim from contact.tsx. */
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  lineHeight: 1.4,
  color: 'var(--muted-fg)',
};

/** Shared field style — verbatim from contact.tsx (the magenta focus ring comes
 *  from the scoped `.tmpl-contact-field` class). */
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

export interface ContactFormProps {
  /** The target portfolio id (from `section.portfolio_id`). */
  portfolioId: string;
  /** The optional public email — woven into the generic error escape-hatch copy. */
  emailPublic?: string | null;
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export function ContactForm({ portfolioId, emailPublic }: ContactFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [state, setState] = useState<SubmitState>('idle');

  // Turnstile defer (08-03): `armed` gates the real widget mount. It flips true when
  // the reserved slot nears the viewport or the user first focuses/points at the form
  // — keeping `challenges.cloudflare.com` off the public first-paint (D-11 TBT).
  const [armed, setArmed] = useState(false);
  const slotRef = useRef<HTMLDivElement | null>(null);

  const submitting = state === 'submitting';
  // Submit is disabled until a Turnstile token is set (the widget contract).
  const canSubmit = !!token && !submitting;

  // Arm-on-near-viewport: load the widget slightly before the form scrolls in
  // (`rootMargin:'200px'`) so a solved token is ready by the time a human reaches it.
  // Guarded for SSR / browsers without IntersectionObserver — those arm on first
  // focus/pointer-down (the `arm` handler below) instead, so the widget always mounts.
  useEffect(() => {
    if (armed) return;
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const node = slotRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setArmed(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [armed]);

  // Belt-and-suspenders: a user who tabs/clicks straight into the form arms it now
  // (covers the no-IntersectionObserver path and an instant-focus deep link).
  const arm = () => {
    if (!armed) setArmed(true);
  };

  // Generic error copy — IDENTICAL for 400/429/500 (D-04, never branch on 429).
  const errorCopy = emailPublic
    ? `Something went wrong sending that. Email me directly at ${emailPublic} and I'll reply.`
    : 'Something went wrong sending that. Please try again in a moment.';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || submitting) return;
    setState('submitting');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          portfolio_id: portfolioId,
          sender_name: name,
          sender_email: email,
          // subject is optional — send only when non-empty.
          ...(subject.trim() ? { subject: subject.trim() } : {}),
          body,
          turnstile_token: token,
        }),
      });

      if (res.ok) {
        setState('success');
        return;
      }
      // Any non-ok (400/429/500 — IDENTICAL handling, never leak the cap, D-04).
      throw new Error('submit_failed');
    } catch {
      setState('error');
      // Mint a fresh Turnstile token for the next attempt (Pitfall 5 — single-use).
      setToken(null);
      setResetSignal((n) => n + 1);
    }
  }

  // ── Success state — the form body is replaced by the confirmation (Surface 1) ──
  if (state === 'success') {
    return (
      <div
        className="tmpl-contact-success-pulse"
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          maxWidth: '640px',
          padding: '24px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Success check glyph (inline SVG, template layer — no chrome icon import). */}
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--success)"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, marginTop: '2px' }}
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: 1.6,
            color: 'var(--fg)',
            margin: 0,
          }}
        >
          Thanks — your message landed. I&rsquo;ll get back to you.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onFocus={arm}
      onPointerDown={arm}
      noValidate
      aria-busy={submitting}
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
          required
          disabled={submitting}
          value={name}
          onChange={(e) => setName(e.target.value)}
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
          required
          disabled={submitting}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="tmpl-contact-field"
          style={fieldStyle}
        />
      </div>

      {/* Message field → sender body. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label htmlFor="contact-message" style={labelStyle}>
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          placeholder="Tell me what you're working on."
          required
          disabled={submitting}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="tmpl-contact-field"
          style={{ ...fieldStyle, resize: 'vertical', minHeight: '120px' }}
        />
      </div>

      {/* Reserved 65px Turnstile slot — present whether armed or not so CLS stays 0
          (08-03). The widget is mounted only once `armed` (near-viewport or first
          focus/pointer-down), keeping `challenges.cloudflare.com` off the first-paint.
          `data-testid="turnstile-slot"` is the stable hook the visual-parity spec masks
          (deferred third-party content is now nondeterministic in a full-page capture). */}
      <div
        ref={slotRef}
        data-testid="turnstile-slot"
        style={{ minHeight: '65px', display: 'flex', alignItems: 'center' }}
      >
        <div style={{ width: '100%' }}>
          {armed ? <TurnstileWidget onToken={setToken} resetSignal={resetSignal} /> : null}
        </div>
      </div>

      {/* Generic error (IDENTICAL for 400/429/500 — D-04), role="alert". */}
      {state === 'error' ? (
        <p
          role="alert"
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: 1.6,
            color: 'var(--destructive)',
            margin: 0,
          }}
        >
          {errorCopy}
        </p>
      ) : null}

      {/* Submit — magenta fill kept in every state; dark-ink label var(--bg). */}
      <button
        type="submit"
        disabled={!canSubmit}
        aria-busy={submitting}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          alignSelf: 'flex-start',
          minHeight: '44px',
          padding: '0 24px',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          opacity: canSubmit ? 1 : 0.6,
          background: 'var(--accent)',
          color: 'var(--bg)',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: '16px',
          // Per-template CTA glow. Defaults to the original magenta so EVERY existing template
          // renders byte-identically (the fallback resolves to the exact prior value — no
          // baseline churn); a template that wants its OWN accent glow (e.g. blueprint's blue)
          // defines `--tmpl-contact-cta-shadow` scoped under its root.
          boxShadow: 'var(--tmpl-contact-cta-shadow, 0 8px 28px -12px rgba(255,45,149,0.38))',
        }}
      >
        {submitting ? (
          <>
            {/* Spinner in var(--bg) ink (reduced-motion zeroes the spin via the
                template's blanket reset — the label still reads "Sending…"). */}
            <span
              aria-hidden="true"
              className="tmpl-contact-spinner"
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: '2px solid var(--bg)',
                borderTopColor: 'transparent',
                display: 'inline-block',
              }}
            />
            Sending…
          </>
        ) : (
          'Send message'
        )}
      </button>

      {/* Public-email fallback (render-if-present) — the escape hatch. */}
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
            href={safeHref(`mailto:${encodeURIComponent(emailPublic)}`, {
              allowMailto: true,
            })}
            style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}
          >
            {emailPublic}
          </a>
          .
        </p>
      ) : null}
    </form>
  );
}
