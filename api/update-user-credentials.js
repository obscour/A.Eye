import supabase from './_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body || {}
    const { userId, username, email, password } = body

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' })
    }

    // Build update object with only provided fields
    const updateData = {}
    
    if (username !== undefined) {
      // Check if username already exists (excluding current user)
      const { data: existingUser } = await supabase
        .from('users')
        .select('uuid')
        .eq('username', username)
        .neq('uuid', userId)
        .maybeSingle()
      
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' })
      }
      updateData.username = username
    }

    if (email !== undefined) {
      // Check if email already exists (excluding current user)
      const { data: existingUser } = await supabase
        .from('users')
        .select('uuid')
        .eq('email', email)
        .neq('uuid', userId)
        .maybeSingle()
      
      if (existingUser) {
        return res.status(400).json({ error: 'Email already taken' })
      }
      updateData.email = email
    }

    if (password !== undefined) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' })
      }
      updateData.password = password
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    // Update user
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('uuid', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating user:', error)
      return res.status(500).json({ error: 'Failed to update user credentials' })
    }

    return res.status(200).json({ message: 'User credentials updated successfully', user: data })
  } catch (err) {
    console.error('Update user credentials error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

