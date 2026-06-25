/**
 * Blueprint blog prose primitives — a FAITHFUL transcription of the export's
 * `src/components/portfolio/Markdown.tsx` element styling, re-expressed as a react-markdown
 * `Components` map for the shared `renderMarkdown` pipeline (passed in per-template). Pure
 * Server Components (stateless — no `'use client'`); they render INSIDE the `.tmpl-blueprint`
 * shell, so the base heading rule (`--font-display`) + the scoped `.bp-mono` class + every
 * `var(--token)` resolve correctly. Layout/type Tailwind kept verbatim; colors → inline
 * `var(--token)`.
 *
 * The export's blog code blocks are DISPLAY-ONLY mono on a surface panel (NO syntax
 * highlighting) — so blueprint's `code`/`pre` are plain styled boxes (no Shiki token bridge),
 * matching the export 1:1. All raw HTML is already dropped upstream (`skipHtml`) and links/imgs
 * are url-policy-filtered, so these components never see unsafe input.
 */
import type { Components } from 'react-markdown';

const fg85 = 'color-mix(in srgb, var(--fg) 85%, transparent)';
const fg90 = 'color-mix(in srgb, var(--fg) 90%, transparent)';

export const blueprintProseComponents: Components = {
  h1: ({ children }) => <h1 className="mt-12 text-3xl font-semibold tracking-tight">{children}</h1>,
  h2: ({ children }) => (
    <h2
      className="mt-12 mb-4 text-2xl font-semibold tracking-tight border-l-2 pl-3"
      style={{ borderColor: 'var(--accent)' }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="mt-8 mb-3 text-xl font-semibold">{children}</h3>,
  p: ({ children }) => (
    <p className="my-5 leading-[1.8] text-[17px]" style={{ color: fg85 }}>
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-5 space-y-2 pl-5 list-disc" style={{ color: fg85 }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="bp-mono my-5 space-y-2 pl-5 list-decimal" style={{ color: fg85 }}>
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="pl-1" style={{ ['--tw-prose-bullets' as string]: 'var(--accent)' }}>
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="my-6 border-l-2 px-5 py-4 italic"
      style={{
        borderColor: 'var(--accent)',
        backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)',
        color: fg90,
      }}
    >
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-4"
      style={{ color: 'var(--accent-text)' }}
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: 'var(--fg)' }}>
      {children}
    </strong>
  ),
  hr: () => <hr className="my-10" style={{ borderColor: 'var(--border)' }} />,
  pre: ({ children }) => (
    <pre
      className="bp-mono my-6 overflow-x-auto rounded-md border p-4 text-[13px] leading-relaxed"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? '');
    if (isBlock) {
      return (
        <code className="bp-mono text-[13px]" style={{ color: fg90 }}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="bp-mono text-[13px] rounded-sm border px-1.5 py-0.5"
        style={{
          backgroundColor: 'var(--surface-muted)',
          borderColor: 'var(--border)',
          color: 'var(--accent-text)',
        }}
      >
        {children}
      </code>
    );
  },
};
