import { createClient } from '@supabase/supabase-js'

/**
 * IMPORTANT: This client MUST use the SERVICE ROLE KEY (not anon key) to bypass RLS.
 * 
 * The service role key:
 * - Bypasses Row Level Security (RLS) policies
 * - Has full database access
 * - Should NEVER be exposed to the client-side
 * 
 * Get your service role key from:
 * Supabase Dashboard → Project Settings → API → service_role key (secret)
 * 
 * Environment variable: SUPABASE_KEY should be set to your service_role key
 */

// Support both SUPABASE_KEY and SUPABASE_SERVICE_ROLE_KEY for flexibility
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY

// Validate environment variables
if (!process.env.SUPABASE_URL || !serviceRoleKey) {
  console.error('Missing Supabase environment variables!')
  console.error('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing')
  console.error('SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? 'Set' : 'Missing')
  console.error('\n⚠️  IMPORTANT: You MUST use the SERVICE ROLE KEY (not anon key) to bypass RLS!')
  console.error('   Get it from: Supabase Dashboard → Project Settings → API → service_role key')
}

// Create Supabase client with service role key
// This automatically bypasses RLS policies
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  serviceRoleKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export default supabase