import supabase from '../lib/_supabaseClient.js'
import { randomUUID } from 'crypto'
import { requireAuth, canAccessUserData } from '../lib/auth-middleware.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const requester = req.user; // From auth middleware
    const { userId, stats } = req.body

    if (!userId || !stats) {
      return res.status(400).json({ error: 'Missing userId or stats' })
    }

    // Authorization: Users can only save their own performance history
    if (!canAccessUserData(requester, userId)) {
      return res.status(403).json({ error: 'Forbidden: Can only save your own performance history' });
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

// Wrap with authorization - users can only save their own data
export default requireAuth(handler, {
  requireOwnData: true
});

