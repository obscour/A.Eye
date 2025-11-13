import supabase from './_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { teacherId } = req.body

    if (!teacherId) {
      return res.status(400).json({ error: 'Missing teacherId' })
    }

    // Get all sections for this teacher
    const { data: sections, error } = await supabase
      .from('sections')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

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
        
        return {
          ...section,
          student_count: count || 0
        }
      })
    )

    return res.status(200).json({ sections: sectionsWithCounts })
  } catch (err) {
    console.error('Get sections error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

