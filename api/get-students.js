import supabase from '../lib/_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('uuid, username, email, role, created_at, first_name, last_name')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ users: users || [] })
  } catch (err) {
    console.error('Get students error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

