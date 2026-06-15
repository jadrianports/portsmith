/**
 * D-14 — `withHeroResumeUrl` makes `profiles.resume_url` the single source of truth for
 * the hero "Download CV/résumé" button by injecting it into the hero content at READ
 * time (get-portfolio + get-portfolio-owner). Guards the stale-button regression: a CMS
 * resume change must override whatever the seed baked into the hero content.
 */
import { describe, expect, it } from 'vitest';

import { withHeroResumeUrl } from '@/lib/portfolio/inject-hero-resume';
import type { PublicSection } from '@/components/templates/types';

// Minimal PublicSection-shaped fixtures (only the fields the injector touches).
function section(type: string, content: unknown): PublicSection {
  return { type, content } as unknown as PublicSection;
}

describe('withHeroResumeUrl', () => {
  it('OVERWRITES a stale seeded resume_url on the hero with the live profile value', () => {
    const sections = [
      section('hero', { heading: 'Hi', resume_url: 'https://example.com/kai-nakamura-cv.pdf' }),
      section('about', { bio: 'x' }),
    ];
    const out = withHeroResumeUrl(sections, 'https://cdn.example.com/real-upload.pdf');
    const hero = out.find((s) => s.type === 'hero')!;
    expect((hero.content as { resume_url: string }).resume_url).toBe(
      'https://cdn.example.com/real-upload.pdf',
    );
    // non-hero untouched
    expect(out.find((s) => s.type === 'about')!.content).toEqual({ bio: 'x' });
  });

  it('injects onto a hero that had NO resume_url (real non-seeded user)', () => {
    const out = withHeroResumeUrl([section('hero', { heading: 'Hi' })], 'https://x/cv.pdf');
    expect((out[0].content as { resume_url: string }).resume_url).toBe('https://x/cv.pdf');
  });

  it('sets resume_url to null when the profile has no resume (button hides)', () => {
    const out = withHeroResumeUrl([section('hero', { heading: 'Hi', resume_url: 'https://old' })], null);
    expect((out[0].content as { resume_url: string | null }).resume_url).toBeNull();
  });

  it('is a no-op when there is no hero section', () => {
    const sections = [section('about', { bio: 'x' }), section('contact', { heading: 'c' })];
    expect(withHeroResumeUrl(sections, 'https://x/cv.pdf')).toEqual(sections);
  });

  it('defensively leaves a non-object / null hero content untouched', () => {
    expect(withHeroResumeUrl([section('hero', null)], 'https://x/cv.pdf')[0].content).toBeNull();
    expect(withHeroResumeUrl([section('hero', ['a'])], 'https://x/cv.pdf')[0].content).toEqual(['a']);
  });
});
