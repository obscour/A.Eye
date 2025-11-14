import supabase from './_supabaseClient.js'
import { randomUUID } from 'crypto'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Check if Supabase client is initialized
    if (!supabase) {
      console.error('Supabase client not initialized')
      return res.status(500).json({ error: 'Server configuration error: Supabase client not initialized' })
    }

    const body = req.body || {}
    const { userId, activity, details } = body

    if (!userId || !activity) {
      return res.status(400).json({ error: 'Missing required fields: userId and activity' })
    }

    const timestamp = new Date().toISOString()

    const { data, error } = await supabase
      .from('audit_logs')
      .insert([{
        id: randomUUID(),
        user_id: userId,
        activity,
        details: details || '',
        timestamp
      }])
      .select()

    if (error) {
      console.error('Error saving audit log:', error)
      // Provide more detailed error information
      const errorDetails = {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      }
      return res.status(500).json({ 
        error: 'Failed to save audit log',
        details: errorDetails
      })
    }

    return res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('Audit log error:', err)
    return res.status(500).json({ 
      error: err.message || 'Internal server error',
      type: err.name || 'UnknownError'
    })
  }
}
