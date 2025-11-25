import supabase from '../lib/_supabaseClient.js'

export default async function handler(req, res) {
  // Support both GET and POST methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get userId from query params (GET) or body (POST)
    const userId = req.method === 'GET' 
      ? req.query.userId 
      : (req.body || {}).userId

    let query = supabase
      .from('audit_log')
      .select('*')

    // If userId is provided, filter by user; otherwise return all logs
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query.order('timestamp', { ascending: false })

    if (error) {
      console.error('Error fetching audit logs:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ logs: data || [] })
  } catch (err) {
    console.error('Get audit logs error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
