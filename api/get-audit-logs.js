import supabase from './_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body || {}
    const { userId } = body

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' })
    }

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })

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
