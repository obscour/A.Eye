import supabase from './_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('uuid, email, username, role, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return res.status(500).json({ error: error.message })
    }

    // Return all users (excluding admins unless specifically requested)
    const users = (data || []).filter(user => 
      user.role !== 'admin' || !user.role
    )

    return res.status(200).json({ users })
  } catch (err) {
    console.error('Get users error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

