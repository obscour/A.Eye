import supabase from './_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sectionId, teacherId, pinned } = req.body

    if (!sectionId || !teacherId || pinned === undefined) {
      return res.status(400).json({ error: 'Missing sectionId, teacherId, or pinned status' })
    }

    // Verify the section belongs to this teacher
    const { data: section, error: checkError } = await supabase
      .from('sections')
      .select('id, teacher_id')
      .eq('id', sectionId)
      .single()

    if (checkError || !section) {
      return res.status(404).json({ error: 'Section not found' })
    }

    if (section.teacher_id !== teacherId) {
      return res.status(403).json({ error: 'You do not have permission to modify this section' })
    }

    // Update pin status
    const { data, error } = await supabase
      .from('sections')
      .update({ pinned: pinned })
      .eq('id', sectionId)
      .select()
      .single()

    if (error) {
      console.error('Error updating pin status:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ section: data })
  } catch (err) {
    console.error('Toggle pin section error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

