'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Factory: call this inside components/hooks to get a browser client.
 * Usage: const supabase = createClient();
 */
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

/**
 * Default singleton for legacy code that imports `supabase` directly.
 * Usage: import supabase from '@/lib/supabase'
 */
const supabase = createClient();
export default supabase;
