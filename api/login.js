import supabase from './_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Parse request body - in Vercel, body is already parsed
    const body = req.body || {}
    
    console.log('Login request body:', { identifier: body?.identifier ? 'present' : 'missing', password: body?.password ? 'present' : 'missing' })

    const { identifier, password } = body

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Missing identifier or password', received: { identifier: !!identifier, password: !!password } })
    }

    // Check if Supabase client is initialized
    if (!supabase) {
      console.error('Supabase client not initialized')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const column = identifier.includes('@') ? 'email' : 'username'
    
    const { data, error } = await supabase
      .from('users')
      .select('uuid, email, username, password, role')
      .eq(column, identifier)
      .single()

    if (error) {
      console.error('Supabase query error:', error)
      // Check if it's a "not found" error
      if (error.code === 'PGRST116' || error.message?.includes('No rows') || error.message?.includes('JSON object requested, multiple')) {
        return res.status(400).json({ error: 'User not found', details: `No user found with ${column}: ${identifier}` })
      }
      return res.status(500).json({ error: 'Database query failed', details: error.message })
    }

    if (!data) {
      return res.status(400).json({ error: 'User not found', details: `No user found with ${column}: ${identifier}` })
    }

    if (data.password !== password) {
      return res.status(401).json({ error: 'Invalid password' })
    }

    // Return user with id field for frontend compatibility
    const user = {
      ...data,
      id: data.uuid
    }

    return res.status(200).json({ user })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ 
      error: 'Login failed',
      message: err.message || 'Internal server error'
    })
  }
}