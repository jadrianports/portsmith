'use client';

/**
 * UrlInput (04-UI-SPEC §8) — extends the chrome Input with http(s)-only inline
 * validation. The paste-a-link field for avatar URL, resume URL (D-P4-05) and the
 * link fields (live_url / repo_url / social).
 *
 * Inline validation MIRRORS the `httpUrlOrEmptyOptional` Zod gate
 * (`@/lib/validations/sections.ts`): empty is valid (the field is optional), a
 * non-empty value MUST be http(s). This client check is UX ONLY — the SAME gate
 * is re-parsed server-side in `saveProfileAction` (CR-01 / T-04-04b). The error
 * copy "Enter a link starting with http:// or https://" matches the schema's
 * "Must be an http(s) URL" so the two layers read consistently.
 *
 * Validation fires on BLUR (so the user isn't nagged mid-typing) and the error
 * clears as soon as the value becomes valid again. A valid, non-empty value shows
 * a subtle trailing `check` in `--color-success` — color paired with the glyph
 * (color-independence). For an avatar the caller may opt into a 40px round
 * thumbnail that falls back silently to a placeholder if the image 404s (no scary
 * error for a typo'd image link).
 *
 * Token-driven chrome only (SHARED-E): zero inline hex, zero template-token
 * reach.
 */
import { Check } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { Input, type InputProps } from '@/components/ui/input';

const HELPER = 'Paste a link starting with http:// or https://';
const SCHEME_ERROR = 'Enter a link starting with http:// or https://';

/** Mirrors `httpUrlOrEmptyOptional`: empty allowed; non-empty must be http(s). */
function isValidUrlValue(value: string): boolean {
  const v = value.trim();
  if (v === '') return true; // optional field — empty is valid
  try {
    const parsed = new URL(v);
    // The WHATWG `protocol` is lowercased and carries the trailing colon.
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface UrlInputProps
  extends Omit<InputProps, 'type' | 'inputMode' | 'autoComplete' | 'value' | 'defaultValue'> {
  /** Controlled value. */
  value: string;
  /** Change handler — receives the raw string. */
  onValueChange: (value: string) => void;
  /**
   * Server-provided / form-level error for this field (e.g. a fieldError returned
   * by `saveProfileAction`). Takes precedence over the local blur error so the
   * authoritative server message wins.
   */
  error?: string;
  /** Optional helper override; defaults to the paste-a-link copy. */
  helper?: ReactNode;
}

export function UrlInput({ value, onValueChange, error, helper, id: idProp, ...props }: UrlInputProps) {
  const reactId = useId();
  const id = idProp ?? reactId;
  const [touched, setTouched] = useState(false);

  // Local (client) scheme error only after blur, and only when the server hasn't
  // already supplied an authoritative error.
  const localError = touched && !isValidUrlValue(value) ? SCHEME_ERROR : undefined;
  const shownError = error ?? localError;

  const valid = value.trim() !== '' && isValidUrlValue(value);

  return (
    <div className="relative">
      <Input
        {...props}
        id={id}
        type="url"
        inputMode="url"
        autoComplete="url"
        placeholder="https://…"
        value={value}
        error={shownError}
        helper={shownError ? undefined : (helper ?? HELPER)}
        onChange={(e) => onValueChange(e.target.value)}
        onBlur={(e) => {
          setTouched(true);
          props.onBlur?.(e);
        }}
      />
      {valid && !shownError ? (
        // Valid, non-empty: a subtle success check (color + glyph) sitting in the
        // field's top-right, clear of the focus ring.
        <Check
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-[2.6rem] size-4 text-success"
        />
      ) : null}
    </div>
  );
}
