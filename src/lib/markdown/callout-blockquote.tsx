/**
 * GitHub alert syntax → the export's neon `Callout` (D-13, RESEARCH Pattern 1b).
 *
 * No new dependency (NOT `remark-github-blockquote-alert`): we detect the
 * leading `[!TYPE]` marker by inspecting the blockquote's rendered children.
 * GFM parses `> [!NOTE]\n> body` to a `<blockquote>` whose first child is a
 * `<p>` whose first text child is `[!NOTE]`. We strip that marker text and
 * render `<Callout tone={…}>` with the remaining children; a plain blockquote
 * (no marker) renders `<ProseBlockquote>`.
 *
 * ALERT_TONE (RESEARCH Pattern 1b):
 *   NOTE / TIP        → cyan
 *   IMPORTANT         → purple
 *   WARNING / CAUTION → pink
 */
import { Children, cloneElement, isValidElement, type ReactNode } from 'react';

import { Callout, ProseBlockquote } from '@/components/templates/edgerunner-v2/pages/blog/prose';

type Tone = 'cyan' | 'purple' | 'pink';

const ALERT_TONE: Record<string, Tone> = {
  NOTE: 'cyan',
  TIP: 'cyan',
  IMPORTANT: 'purple',
  WARNING: 'pink',
  CAUTION: 'pink',
};

/** Leading `[!TYPE]` marker (optionally followed by whitespace/newline). */
const ALERT_RE = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;

interface DetectResult {
  type: keyof typeof ALERT_TONE;
  /** The blockquote children with the marker text stripped. */
  stripped: ReactNode;
}

/**
 * Strip the leading `[!TYPE]` marker from the first string found in the
 * blockquote's children tree, returning the matched type + the stripped
 * children. Returns null when no marker leads the content.
 *
 * The marker lives at the very start of the first paragraph's first text node.
 * We walk into the first element child once (the `<p>`), then strip its first
 * string child. A leading newline (the GFM `> [!NOTE]\n> body` form) is also
 * consumed by ALERT_RE's trailing `\s*`.
 */
function detectAlert(children: ReactNode): DetectResult | null {
  const top = Children.toArray(children);

  // Find the first paragraph element (skip whitespace-only string nodes).
  const firstIdx = top.findIndex((c) => isValidElement(c) || (typeof c === 'string' && c.trim()));
  if (firstIdx === -1) return null;
  const first = top[firstIdx];

  // Case A: the marker is leading text directly in the blockquote children.
  if (typeof first === 'string') {
    const m = first.match(ALERT_RE);
    if (!m) return null;
    const strippedFirst = first.replace(ALERT_RE, '');
    const rest = top.slice(firstIdx + 1);
    return {
      type: m[1] as keyof typeof ALERT_TONE,
      stripped: [strippedFirst, ...rest],
    };
  }

  // Case B: the marker is the first text child of the first <p> element.
  if (isValidElement(first)) {
    const el = first as React.ReactElement<{ children?: ReactNode }>;
    const inner = Children.toArray(el.props.children);
    if (inner.length === 0 || typeof inner[0] !== 'string') return null;
    const m = inner[0].match(ALERT_RE);
    if (!m) return null;
    const strippedHead = inner[0].replace(ALERT_RE, '');
    const newInner = [strippedHead, ...inner.slice(1)];
    const strippedFirstEl = cloneElement(el, undefined, ...newInner);
    return {
      type: m[1] as keyof typeof ALERT_TONE,
      stripped: [strippedFirstEl, ...top.slice(firstIdx + 1)],
    };
  }

  return null;
}

/**
 * The `blockquote` component: renders a tone-mapped `Callout` when a `[!TYPE]`
 * marker leads the quote, else a plain `ProseBlockquote`.
 */
export function CalloutOrQuote({ children }: { children?: ReactNode }) {
  const match = detectAlert(children);
  if (match) return <Callout tone={ALERT_TONE[match.type]}>{match.stripped}</Callout>;
  return <ProseBlockquote>{children}</ProseBlockquote>;
}
