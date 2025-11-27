// Consolidated user data API - handles stats and performance history
import supabase from '../lib/_supabaseClient.js'
import { requireAuth, canAccessUserData, teacherCanAccessStudent } from '../lib/auth-middleware.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { action, userId, startDate, endDate, limit } = req.body
    const requester = req.user // From auth middleware

    if (!action) {
      return res.status(400).json({ error: 'Missing action. Use "get-stats" or "get-history"' })
    }

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' })
    }

    // Authorization: Users can only access their own data, or teachers can access their students
    if (!canAccessUserData(requester, userId)) {
      if (requester.role === 'teacher') {
        const canAccess = await teacherCanAccessStudent(requester, userId)
        if (!canAccess) {
          return res.status(403).json({ error: 'Forbidden: Cannot access this user\'s data' })
        }
      } else {
        return res.status(403).json({ error: 'Forbidden: Cannot access this user\'s data' })
      }
    }

    if (action === 'get-stats') {
      // Get ALL performance history records for this user to calculate averages
      const { data: allHistoryData, error: historyError } = await supabase
        .from('performance_history')
        .select('stats, recorded_at')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: true })

      if (historyError) {
        console.error('Error fetching performance history:', historyError)
        return res.status(500).json({ error: historyError.message })
      }

      // If no history exists, return empty stats structure
      if (!allHistoryData || allHistoryData.length === 0) {
        const emptyStats = {}
        for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
          emptyStats[char] = { streak: 0, correct: 0, mastery: 0, attempts: 0 }
        }
        return res.status(200).json({ data: { stats: emptyStats } })
      }

      // Initialize accumulator for each letter
      const letterAccumulators = {}
      for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        letterAccumulators[char] = {
          attempts: 0,
          mastery: 0,
          correct: 0,
          streak: 0,
          count: 0
        }
      }

      // Sum up all values from all history records
      allHistoryData.forEach(record => {
        if (!record.stats) return
        
        const stats = typeof record.stats === 'string' 
          ? JSON.parse(record.stats) 
          : record.stats

        for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
          if (stats[char]) {
            const letterData = stats[char]
            letterAccumulators[char].attempts += Number(letterData.attempts) || 0
            letterAccumulators[char].mastery += Number(letterData.mastery) || 0
            letterAccumulators[char].correct += Number(letterData.correct) || 0
            letterAccumulators[char].streak += Number(letterData.streak) || 0
            letterAccumulators[char].count += 1
          }
        }
      })

      // Calculate averages for each letter
      const averagedStats = {}
      for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        const acc = letterAccumulators[char]
        const count = acc.count
        
        if (count === 0) {
          averagedStats[char] = {
            attempts: 0,
            mastery: 0,
            correct: 0,
            streak: 0
          }
        } else {
          averagedStats[char] = {
            attempts: acc.attempts / count,
            mastery: acc.mastery / count,
            correct: acc.correct / count,
            streak: acc.streak / count
          }
        }
      }

      return res.status(200).json({ data: { stats: averagedStats } })
    }

    if (action === 'get-history') {
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
    }

    return res.status(400).json({ error: 'Invalid action. Use "get-stats" or "get-history"' })
  } catch (err) {
    console.error('User data error:', err)
    return res.status(500).json({ 
      error: err.message || 'Internal server error'
    })
  }
}

// Wrap with authorization
export default requireAuth(handler, {
  customCheck: async (user, req) => {
    const { userId } = req.body
    if (!userId) return false
    
    if (user.uuid === userId) return true
    if (user.role === 'mis') return true
    if (user.role === 'teacher') {
      return await teacherCanAccessStudent(user, userId)
    }
    return false
  }
})

