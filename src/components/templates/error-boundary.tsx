'use client';

/**
 * Template error boundary (TMPL-03 / RESEARCH Pattern 1; threats T-03-12 DoS +
 * V7 error handling).
 *
 * React error boundaries MUST be Client Components — they rely on the class
 * lifecycle hooks (`getDerivedStateFromError` / `componentDidCatch`) which are not
 * available to Server Components. This is the ONLY client boundary the engine adds;
 * it wraps the (server-rendered) template so a broken/throwing template degrades to
 * a graceful fallback instead of crashing the whole public route into a 500.
 *
 * The same `Fallback` is rendered for the unknown-slug case by `TemplateRenderer`
 * (before any template is even resolved).
 *
 * SECURITY (V7 — no information disclosure): the fallback NEVER renders the caught
 * error's message, stack, or any other detail. It shows a fixed, generic notice so
 * no internal path / secret / stack frame can leak to a public visitor.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * The generic, detail-free fallback. Used both as the error-boundary's render
 * after a caught render error AND directly by `TemplateRenderer` for an unknown
 * slug. Intentionally minimal and free of any error detail (V7).
 */
function Fallback() {
  return (
    <main
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>This page is unavailable</h1>
      <p style={{ opacity: 0.7 }}>This portfolio could not be displayed right now.</p>
    </main>
  );
}

interface TemplateErrorBoundaryState {
  hasError: boolean;
}

/**
 * Class error boundary wrapping a resolved template. On a render error it swaps to
 * the generic `Fallback` (no detail leaked). Exposes `Fallback` as a static member
 * so `TemplateRenderer` (a Server Component) can render the SAME fallback for the
 * unknown-slug path without importing a second symbol.
 */
export class TemplateErrorBoundary extends Component<
  { children: ReactNode },
  TemplateErrorBoundaryState
> {
  /** The shared generic fallback (also used for the unknown-slug case). */
  static Fallback = Fallback;

  state: TemplateErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): TemplateErrorBoundaryState {
    // Flip to the fallback; deliberately do NOT capture the error into state so it
    // can never reach the rendered output (V7 — no stack/secret leakage).
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Server-side observability only; this string never reaches the client DOM.
    // Phase 6 can route this to a real logger. Keep it off the public render.
    console.error('[template] render error', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <Fallback />;
    }
    return this.props.children;
  }
}
