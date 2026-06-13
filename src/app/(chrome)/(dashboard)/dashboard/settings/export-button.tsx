'use client';

/**
 * Export-content island (ACCT-04 / D-13 / D-14, settings).
 *
 * A single chrome action that downloads the owner's portfolio content as JSON by
 * navigating to the authenticated `GET /api/account/export` route. The route sets
 * `Content-Disposition: attachment; filename="portsmith-export.json"`, so the
 * browser saves the response as a file rather than rendering it. The read is an
 * authenticated RLS owner read server-side — this island only triggers the
 * navigation; it never assembles or touches the data.
 *
 * The trigger is an anchor with the `download` hint pointing at the route (a plain
 * same-origin GET — no fetch/blob plumbing needed; the route's Content-Disposition
 * does the work, and a same-tab GET to a download response does not navigate the
 * page away). Styled as the chrome primary Button via `Button asChild`-free
 * composition is unavailable here, so the anchor borrows the Button's look through
 * a shared className set — chrome tokens only (Inter, Evergreen/Copper); the Copper
 * accent stays focus-ring only, never a fill, so the action uses the primary fill.
 *
 * A short caption states exactly what the export includes (the user's own content:
 * profile, sections, settings, blog posts) and what it does NOT (the contact inbox —
 * visitor PII is excluded by D-13), so the scope is never a surprise.
 */
const ACTION_CLASSNAME =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md ' +
  'bg-brand px-5 text-sm font-semibold text-brand-foreground outline-none ' +
  'transition-colors hover:bg-brand-hover ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  'motion-reduce:transition-none';

export function ExportButton() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Download a JSON file of your own content — your profile, all sections
        (including hidden ones), your settings, and your blog posts. Your contact
        inbox is not included.
      </p>
      <a href="/api/account/export" download className={ACTION_CLASSNAME}>
        Export my content (JSON)
      </a>
    </div>
  );
}
