import supabase from './_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })

    if (error) {
      console.error('Error fetching all audit logs:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ logs: data || [] })
  } catch (err) {
    console.error('Get all audit logs error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
