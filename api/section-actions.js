import supabase from './_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { action, sectionId, teacherId, pinned } = req.body

    if (!action || !sectionId || !teacherId) {
      return res.status(400).json({ error: 'Missing action, sectionId, or teacherId' })
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

    if (action === 'delete') {
      // Delete section (cascade will delete section_students automatically)
      const { error } = await supabase
        .from('sections')
        .delete()
        .eq('id', sectionId)

      if (error) {
        console.error('Error deleting section:', error)
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json({ message: 'Section deleted successfully' })
    } else if (action === 'toggle-pin') {
      if (pinned === undefined) {
        return res.status(400).json({ error: 'Missing pinned status' })
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
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "delete" or "toggle-pin"' })
    }
  } catch (err) {
    console.error('Section action error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

