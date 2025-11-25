import supabase from '../lib/_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sectionId } = req.body

    if (!sectionId) {
      return res.status(400).json({ error: 'Missing sectionId' })
    }

    // Get all students in this section
    const { data, error } = await supabase
      .from('section_students')
      .select(`
        joined_at,
        users:student_id (
          uuid,
          username,
          email,
          first_name,
          last_name
        )
      `)
      .eq('section_id', sectionId)

    if (error) {
      console.error('Error fetching section students:', error)
      return res.status(500).json({ error: error.message })
    }

    // Transform the data to a simpler format
    const students = (data || []).map(item => ({
      uuid: item.users?.uuid,
      username: item.users?.username,
      email: item.users?.email,
      first_name: item.users?.first_name,
      last_name: item.users?.last_name,
      joined_at: item.joined_at
    })).filter(s => s.uuid) // Filter out any null entries

    return res.status(200).json({ students })
  } catch (err) {
    console.error('Get section students error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

