/**
 * `POST /api/media/upload` — the SOLE, authoritative upload boundary (OQ-3).
 *
 * The thinnest full media loop's server gate: a signed-in user POSTs a cropped
 * WebP (or a PDF résumé) as multipart FormData{ kind, file }; this route is the
 * single place that verifies identity, sniffs the ACTUAL bytes, enforces the
 * per-kind ceiling + the server-authoritative per-user quota, writes the object
 * under the verified user's own folder, and returns the public URL. Every later
 * slice (05-03 project/testimonial images, 05-04 résumé) reuses this route
 * UNCHANGED. It does NOT persist the URL or revalidate — the subsequent
 * saveProfileAction / saveSectionAction (SHARED-A) does that (Pattern 2).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RULE-4-RESOLVED OPTION B (supersedes the plan's RESEARCH-A3 authenticated-client
 * guidance). Founder-approved: the Storage WRITE goes through the SERVER-ONLY
 * service-role admin client, gated by an EXPLICIT verified-sub own-folder path —
 * NOT the authenticated client under own-folder INSERT RLS. Rationale (mirrors
 * delete-object.ts): the 002 protected-columns trigger (002:39-122) RAISEs on the
 * `sync_storage_usage` AFTER-INSERT `storage_used_bytes` UPDATE (003:124) UNLESS the
 * Storage op ran under `auth.role()='service_role'` (the 002:55 short-circuit), so an
 * authenticated-client upload would ABORT on the usage-charge leg under the current
 * (locked, do-not-modify) foundation. service_role both syncs usage correctly AND
 * bypasses RLS — fixing the bug with ZERO foundation change, extending CLAUDE.md's
 * sanctioned service-role server-route pattern to Storage. RLS stays the cross-tenant
 * boundary for direct-key access; THIS route is the sanctioned escape hatch and is the
 * boundary that enforces own-folder isolation IN APP CODE: the object path's first
 * segment is built from the VERIFIED `sub` (never client input), so the service-role
 * power can never write into another tenant's folder.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SECURITY (threat register T-05-03/05/06/07/08/09):
 *   [A] getVerifiedClaims() (verified JWT via getClaims — AUTH-05, NEVER getSession);
 *       null claims OR missing `sub` → 401 (WR-05: never coerce `sub` to '').
 *   [B] per-kind byte ceiling (413) — the AUTHORITATIVE image-bomb mitigation (no
 *       server-side decode exists, so a tiny file can't exceed the decode surface).
 *   [C] server-side magic-byte sniff (415) — the ACTUAL bytes, not the client MIME
 *       label, must be in the kind's allowlist (image → image/webp only; SVG/GIF/
 *       JPEG/PNG all rejected; resume → application/pdf). The authoritative MEDIA-01
 *       boundary + the anti-stored-XSS (SVG) and anti-polyglot mitigation.
 *   [D] server-authoritative quota gate (409) — reads the protected
 *       storage_used_bytes and rejects BEFORE the write (MEDIA-03 / D-10).
 *   [E] sub-locked object path via buildObjectPath (Pitfall 5) — first segment is
 *       the verified sub, never a client-supplied path.
 *   [F] typed JSON error bodies only — no stack / internal detail leakage (V13).
 */
import { NextResponse } from 'next/server';

import {
  ALLOWED_IMAGE_MIME,
  ALLOWED_PDF_MIME,
  sniffMime,
} from '@/lib/media/magic-bytes';
import { buildObjectPath } from '@/lib/media/storage-path';
import {
  QUOTA_BYTES,
  UPLOAD_KINDS,
  wouldExceedQuota,
  type UploadKind,
} from '@/lib/media/upload-config';
import { supabaseAdmin } from '@/lib/supabase/service-role';
import { getVerifiedClaims } from '@/lib/supabase/server';

// Pitfall 1 — the route reads bytes + runs file-type's buffer sniff; it must run on
// the Node runtime, never edge.
export const runtime = 'nodejs';

/** The four wire kinds the route accepts (mirrors UPLOAD_KINDS). */
const VALID_KINDS = new Set<UploadKind>([
  'avatar',
  'project',
  'testimonial',
  'resume',
]);

/** True for the three image kinds (resume is the only non-image kind). */
function isImageKind(kind: UploadKind): boolean {
  return kind !== 'resume';
}

/**
 * CR-02 boundary guard: the object-path first segment is cast to `::uuid` by the
 * sync_storage_usage trigger (migration 003). A verified Supabase claim's `sub` is
 * always the user UUID today; asserting the shape here keeps a future non-UUID auth
 * subject (custom JWT / third-party OIDC) from building a path that aborts the usage
 * trigger AFTER the bytes land (returning a URL for an uncharged object).
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request): Promise<NextResponse> {
  // [A] Verified identity (AUTH-05 — never getSession). A null claim or a claim
  //     without a `sub` is a hard 401 — NEVER coerce `sub` to '' (WR-05: that would
  //     build a path under an empty first segment / mask the invariant).
  const claims = await getVerifiedClaims();
  if (!claims) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sub = (claims as { sub?: string }).sub;
  // CR-02: assert the verified subject is a UUID before it becomes the object-path
  // first segment (the usage trigger casts it to ::uuid). Never coerce sub to ''.
  if (!sub || !UUID_RE.test(sub)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Parse multipart body: `kind` (one of UPLOAD_KINDS) + `file` (a Blob).
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const kindRaw = form.get('kind');
  const file = form.get('file');
  if (typeof kindRaw !== 'string' || !VALID_KINDS.has(kindRaw as UploadKind)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const kind = kindRaw as UploadKind;
  const cfg = UPLOAD_KINDS[kind];

  // Read the bytes once (used by the ceiling check, the sniff, and the write).
  const bytes = new Uint8Array(await file.arrayBuffer());

  // [B] Per-kind byte ceiling (413). The authoritative image-bomb mitigation
  //     (T-05-06): there is no server-side decode, so the hard byte cap is the real
  //     backstop.
  if (bytes.byteLength > cfg.ceiling) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }

  // [C] Magic-byte sniff (415) — the ACTUAL content type, NOT the client MIME label
  //     (which is untrusted). Image kinds accept ONLY image/webp; resume accepts ONLY
  //     application/pdf. A renamed JPEG/PNG/GIF/SVG is rejected here (T-05-03/04).
  const sniffed = await sniffMime(bytes);
  const allowed = isImageKind(kind) ? ALLOWED_IMAGE_MIME : ALLOWED_PDF_MIME;
  if (!sniffed || !allowed.has(sniffed)) {
    return NextResponse.json({ error: 'unsupported_type' }, { status: 415 });
  }

  // [D] Quota pre-check (409) — a fast-fail UX nicety, BEFORE any write (MEDIA-03).
  //     DEMOTED (CR-01 / migration 009): this read-then-check is NO LONGER the quota
  //     authority. The 009 `enforce_storage_quota()` BEFORE INSERT trigger on
  //     storage.objects locks the owner's profile row (SELECT ... FOR UPDATE) and
  //     re-checks the cap inside the same txn that charges usage — that DB trigger is
  //     the gate (atomic, zero app trust). This pre-check stays only so an obviously
  //     over-cap upload gets a clean 409 BEFORE bytes are uploaded (it cannot close the
  //     read-then-write race; concurrent uploads slip past it — the trigger catches them
  //     and the [F] handler below maps the RAISE to the same 409).
  //     Read the protected storage_used_bytes via the service-role admin client (the
  //     anon-key authenticated read would also work for SELECT, but the route already
  //     holds the admin client for the write; one client, one source of truth) and
  //     reject if accepting these bytes would push the user OVER QUOTA_BYTES.
  const { data: profile, error: readErr } = await supabaseAdmin
    .from('profiles')
    .select('storage_used_bytes')
    .eq('id', sub)
    .single();
  if (readErr || !profile) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
  const used = Number(
    (profile as { storage_used_bytes?: number | null }).storage_used_bytes ?? 0,
  );
  if (wouldExceedQuota(used, bytes.byteLength)) {
    return NextResponse.json({ error: 'quota_exceeded' }, { status: 409 });
  }

  // [E] Build the sub-locked object path (Pitfall 5): `{sub}/{context}/{nanoid}.{ext}`.
  //     The first segment is the VERIFIED sub — never client input — so the
  //     service-role write can only ever land in the caller's own folder, and the
  //     usage trigger's `::uuid` cast on segment 1 succeeds.
  const ext = kind === 'resume' ? 'pdf' : 'webp';
  const path = buildObjectPath(sub, cfg.context, ext);

  // Write via the SERVICE-ROLE admin client (Option B). RLS is bypassed and the
  // AFTER-INSERT sync_storage_usage trigger charges storage_used_bytes under
  // service_role (002:55 short-circuit — so the usage UPDATE is NOT rejected by the
  // protected-columns trigger). upsert:false so a nanoid collision never clobbers.
  const { error: upErr } = await supabaseAdmin.storage
    .from(cfg.bucket)
    .upload(path, bytes, { contentType: sniffed, upsert: false });
  if (upErr) {
    // [F] CR-01 race-loser mapping (migration 009). When two concurrent near-cap
    //     uploads slip past the [D] pre-check, the 009 BEFORE INSERT trigger RAISEs the
    //     loser with ERRCODE 'check_violation' (Postgres SQLSTATE 23514). The Storage
    //     API surfaces this as a StorageApiError whose message is `database error,
    //     code: 23514` (verified against the live local stack). Detect that signal and
    //     return the SAME 409 quota_exceeded as a pre-check rejection, so a race-loser
    //     and an obvious over-cap upload get identical UX. Any other upload error stays
    //     a generic 500 (the cap is enforced by the trigger regardless of this mapping).
    if (/(^|\D)23514(\D|$)/.test(upErr.message)) {
      return NextResponse.json({ error: 'quota_exceeded' }, { status: 409 });
    }
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  // [F] Return the public URL + path. NO revalidatePath here (Pattern 2 — the
  //     subsequent saveProfileAction / saveSectionAction revalidates).
  const { data: pub } = supabaseAdmin.storage.from(cfg.bucket).getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl, path }, { status: 200 });
}
