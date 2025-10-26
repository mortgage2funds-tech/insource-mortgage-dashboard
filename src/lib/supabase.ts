import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing')
if (!anon) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // avoids Next.js dev route handling issues
  },
})

