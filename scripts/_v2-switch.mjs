/**
 * scripts/_v2-switch.mjs — one-off script to:
 *   1. Insert the `edgerunner-v2` templates row (id …0005, slug 'edgerunner-v2', visibility 'public')
 *      if not already present.
 *   2. Set the founder's portfolio (jadrianports) template_id to …0005.
 *
 * Uses service-role client (bypasses RLS) — same pattern as seed-founder-portfolio.ts.
 * This is a local dev tool, never imported by the app.
 *
 * USAGE: node scripts/_v2-switch.mjs
 */

// Load .env.local
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
} catch {
  // dotenv unavailable — rely on ambient env
}

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[v2-switch] ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const TEMPLATE_UUID = '00000000-0000-4000-8000-000000000005';
const TEMPLATE_SLUG = 'edgerunner-v2';
const FOUNDER_USERNAME = 'jadrianports';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function log(msg) {
  console.log(`[v2-switch] ${msg}`);
}
function fail(msg) {
  console.error(`[v2-switch] ERROR: ${msg}`);
  process.exit(1);
}

// Step 1: Upsert the templates row
log(`Upserting templates row — id: ${TEMPLATE_UUID}, slug: ${TEMPLATE_SLUG}`);
const spec = {
  sections: {
    hero: { supported: true, fields: ['heading', 'subheading', 'cta_text', 'cta_url', 'background_image'] },
    about: { supported: false, fields: [] },
    metrics: { supported: false, fields: [] },
    experience: { supported: false, fields: [] },
    projects: { supported: false, fields: [] },
    skills: { supported: false, fields: [] },
    contact: { supported: false, fields: [] },
    services: { supported: false, fields: [] },
    blog_preview: { supported: false, fields: [] },
  },
  color_presets: ['default'],
  font_presets: ['default'],
};

const { error: tplError } = await supabase
  .from('templates')
  .upsert(
    {
      id: TEMPLATE_UUID,
      slug: TEMPLATE_SLUG,
      name: 'Edgerunner V2',
      description: 'A faithful bar-for-bar transcription of the synthwave Lovable export — exact motion values, neon glow utilities, and animated hero.',
      visibility: 'public',
      spec,
    },
    { onConflict: 'id' }
  );

if (tplError) {
  fail(`templates upsert failed: ${tplError.message}`);
}
log(`templates row upserted OK`);

// Step 2: Find the founder's portfolio by username (via profiles join)
log(`Looking up portfolio for username: ${FOUNDER_USERNAME}`);
const { data: profileRow, error: profileError } = await supabase
  .from('profiles')
  .select('id')
  .eq('username', FOUNDER_USERNAME)
  .single();

if (profileError || !profileRow) {
  fail(`Could not find profile for ${FOUNDER_USERNAME}: ${profileError?.message ?? 'not found'}`);
}

const userId = profileRow.id;
log(`Found user id: ${userId}`);

// Get the portfolio id
const { data: portfolioRow, error: portfolioError } = await supabase
  .from('portfolios')
  .select('id')
  .eq('user_id', userId)
  .single();

if (portfolioError || !portfolioRow) {
  fail(`Could not find portfolio for user ${userId}: ${portfolioError?.message ?? 'not found'}`);
}

const portfolioId = portfolioRow.id;
log(`Found portfolio id: ${portfolioId}`);

// Step 3: Update portfolio template_id
log(`Setting portfolio template_id to ${TEMPLATE_UUID} (edgerunner-v2)`);
const { error: updateError } = await supabase
  .from('portfolios')
  .update({ template_id: TEMPLATE_UUID })
  .eq('id', portfolioId);

if (updateError) {
  fail(`portfolio update failed: ${updateError.message}`);
}

log(`Done — ${FOUNDER_USERNAME} is now on edgerunner-v2 (${TEMPLATE_UUID})`);
