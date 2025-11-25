import supabase from '../lib/_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, startDate, endDate, limit } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' })
    }

    let query = supabase
      .from('performance_history')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('recorded_at', new Date(startDate).toISOString())
    }
    if (endDate) {
      query = query.lte('recorded_at', new Date(endDate).toISOString())
    }

    // Apply limit if provided
    if (limit) {
      query = query.limit(parseInt(limit))
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching performance history:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ 
      history: data || [],
      count: data?.length || 0
    })
  } catch (err) {
    console.error('Get performance history error:', err)
    return res.status(500).json({ 
      error: err.message || 'Internal server error'
    })
  }
}

