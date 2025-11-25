import supabase from '../lib/_supabaseClient.js'
import { randomUUID } from 'crypto'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, stats } = req.body

    if (!userId || !stats) {
      return res.status(400).json({ error: 'Missing userId or stats' })
    }

    const historyRecord = {
      id: randomUUID(),
      user_id: userId,
      stats: typeof stats === 'string' ? JSON.parse(stats) : stats,
      recorded_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('performance_history')
      .insert([historyRecord])
      .select()
      .single()

    if (error) {
      console.error('Error saving performance history:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ 
      message: 'Performance history saved successfully',
      data 
    })
  } catch (err) {
    console.error('Save performance history error:', err)
    return res.status(500).json({ 
      error: err.message || 'Internal server error'
    })
  }
}

