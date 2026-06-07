/**
 * The motion feature bundle for edgerunner-v2's LazyMotion provider (bundle-budget).
 *
 * `domAnimation` = animations + variants + exit animations + tap/hover/focus/inView
 * gestures — everything edgerunner-v2's `m.*` components use (whileInView, whileHover,
 * AnimatePresence). It deliberately EXCLUDES layout + drag (`domMax`), which the template
 * does not use, keeping the deferred feature chunk smaller.
 *
 * Imported ONLY via the async `loadFeatures` thunk in `motion-provider.tsx` so this
 * bundle becomes its OWN async chunk that loads AFTER hydration — keeping the ~24 kB gz
 * of motion features OUT of the public `/[username]` First Load JS (D-25 / TMPL-04
 * ≤200 kB budget). Until it resolves, `m.*` components render their rest state (and under
 * `prefers-reduced-motion` the entrance animations are suppressed anyway), so deferring is
 * visually inert on first paint.
 */
import { domAnimation } from 'motion/react';

export default domAnimation;
