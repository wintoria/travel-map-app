import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// db.retry: false — postgrest-js retries GET/HEAD/OPTIONS on a network error up to 3x with
// exponential backoff (1s/2s/4s) by default. That's exactly right for a flaky connection, but it
// means every offline read stalls for several seconds before falling through to the IndexedDB
// cache. Disable it here; the offline-fallback path in lib/api/* already handles the failure.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, { db: { retry: false } });