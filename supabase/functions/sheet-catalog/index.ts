import { createCatalogHandler } from './catalog.js';
import documents from './documents.json' with { type: 'json' };

const keys = Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}'));
for (const name of ['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY']) {
  const value = Deno.env.get(name);
  if (value) keys.push(value);
}
Deno.serve(createCatalogHandler({ documents, keys }));
