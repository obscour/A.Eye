import supabase from '../lib/_supabaseClient.js'
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

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ error: 'Missing required field: userId' })
    }
    if (!activity) {
      return res.status(400).json({ error: 'Missing required field: activity' })
    }

    // Store timestamp in UTC (default ISO format)
    const timestamp = new Date().toISOString()

    // Try to insert audit log, but don't fail the entire request if it fails
    const { data, error } = await supabase
      .from('audit_log')
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
      // Log the error but return success to not break the main functionality
      // The audit log is supplementary, not critical
      return res.status(200).json({ 
        success: false, 
        warning: 'Audit log could not be saved',
        error: error.message 
      })
    }

    return res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('Audit log error:', err)
    // Return success even if audit log fails - don't break main functionality
    return res.status(200).json({ 
      success: false,
      warning: 'Audit log error occurred',
      error: err.message || 'Internal server error'
    })
  }
}
