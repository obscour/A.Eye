import supabase from './_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('uuid, email, username, role')
      .or('role.eq.student,role.is.null')

    if (error) {
      console.error('Error fetching students:', error)
      return res.status(500).json({ error: error.message })
    }

    // Filter for students (role='student' or no role)
    const students = (data || []).filter(user => 
      user.role === 'student' || !user.role || user.role === null
    )

    return res.status(200).json({ students })
  } catch (err) {
    console.error('Get students error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

