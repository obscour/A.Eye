import supabase from './_supabaseClient.js'
import { randomBytes } from 'crypto'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { teacherId, name } = req.body

    if (!teacherId || !name) {
      return res.status(400).json({ error: 'Missing teacherId or name' })
    }

    // Generate a unique section code (6 characters)
    const code = randomBytes(3).toString('hex').toUpperCase()

    // Create the section
    const { data, error } = await supabase
      .from('sections')
      .insert([{
        teacher_id: teacherId,
        name: name.trim(),
        code: code,
        created_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating section:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ section: data })
  } catch (err) {
    console.error('Create section error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

