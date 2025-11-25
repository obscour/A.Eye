import supabase from '../lib/_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { teacherId, all } = req.body || req.query || {}

    let query = supabase
      .from('sections')
      .select('*')

    // If all=true, get all sections with teacher info (for MIS)
    if (all === 'true' || all === true) {
      query = supabase
        .from('sections')
        .select(`
          *,
          users!sections_teacher_id_fkey (
            uuid,
            username,
            email
          )
        `)
        .order('created_at', { ascending: false })
    } else {
      // Get sections for specific teacher
      if (!teacherId) {
        return res.status(400).json({ error: 'Missing teacherId' })
      }
      query = query
        .eq('teacher_id', teacherId)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
    }

    const { data: sections, error } = await query

    if (error) {
      console.error('Error fetching sections:', error)
      return res.status(500).json({ error: error.message })
    }

    // Get student count for each section
    const sectionsWithCounts = await Promise.all(
      (sections || []).map(async (section) => {
        const { count, error: countError } = await supabase
          .from('section_students')
          .select('*', { count: 'exact', head: true })
          .eq('section_id', section.id)
        
        if (countError) {
          console.error('Error counting students:', countError)
        }
        
        const result = {
          ...section,
          student_count: count || 0
        }

        // If getting all sections, include teacher info
        if (all === 'true' || all === true) {
          result.teacher = section.users || null
        }
        
        return result
      })
    )

    return res.status(200).json({ sections: sectionsWithCounts })
  } catch (err) {
    console.error('Get sections error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

