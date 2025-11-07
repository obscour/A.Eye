import supabase from './_supabaseClient.js'
import { randomUUID } from 'crypto'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body || {}
    const { userId, activity, details, ipAddress } = body

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
        ip_address: ipAddress || 'Unknown',
        timestamp
      }])
      .select()

    if (error) {
      console.error('Error saving audit log:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('Audit log error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

