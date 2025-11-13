import supabase from './_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sectionId, identifier } = req.body

    if (!sectionId || !identifier) {
      return res.status(400).json({ error: 'Missing sectionId or identifier' })
    }

    // Find the student by username or email
    const column = identifier.includes('@') ? 'email' : 'username'
    
    const { data: student, error: studentError } = await supabase
      .from('users')
      .select('uuid, username, email')
      .eq(column, identifier)
      .single()

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    // Check if student is already in the section
    const { data: existing, error: checkError } = await supabase
      .from('section_students')
      .select('*')
      .eq('section_id', sectionId)
      .eq('student_id', student.uuid)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing membership:', checkError)
      return res.status(500).json({ error: checkError.message })
    }

    if (existing) {
      return res.status(400).json({ error: 'Student is already in this section' })
    }

    // Add student to section
    const { data, error } = await supabase
      .from('section_students')
      .insert([{
        section_id: sectionId,
        student_id: student.uuid,
        joined_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error adding student to section:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ 
      message: 'Student added to section successfully',
      student: {
        uuid: student.uuid,
        username: student.username,
        email: student.email
      }
    })
  } catch (err) {
    console.error('Invite student error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

