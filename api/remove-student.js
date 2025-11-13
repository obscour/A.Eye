import supabase from './_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sectionId, studentId } = req.body

    if (!sectionId || !studentId) {
      return res.status(400).json({ error: 'Missing sectionId or studentId' })
    }

    // Remove student from section
    const { error } = await supabase
      .from('section_students')
      .delete()
      .eq('section_id', sectionId)
      .eq('student_id', studentId)

    if (error) {
      console.error('Error removing student from section:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ message: 'Student removed from section successfully' })
  } catch (err) {
    console.error('Remove student error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

