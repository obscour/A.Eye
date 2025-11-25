import { createClient } from '@supabase/supabase-js'

// Validate environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('Missing Supabase environment variables!')
  console.error('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing')
  console.error('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'Set' : 'Missing')
}

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
)

export default supabase
// Note: This is a helper module, not a serverless function
// Vercel may count files with export default in /api as functions
// If you get function count errors, consider using named export instead