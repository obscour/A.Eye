// Consolidated audit API - handles creating and getting audit logs
import supabase from '../lib/_supabaseClient.js'
import { randomUUID } from 'crypto'
import { requireAuth, hasRole, canAccessUserData, teacherCanAccessStudent } from '../lib/auth-middleware.js'

async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { action, userId, activity, details } = req.body || req.query || {}
    
    // For GET requests, get from query params
    const getUserId = req.method === 'GET' ? req.query.userId : userId
    const getAction = req.method === 'GET' ? req.query.action : action

    // Create audit log (no auth required - called from frontend)
    if (getAction === 'create' || (!getAction && activity)) {
      if (!userId) {
        return res.status(400).json({ error: 'Missing required field: userId' })
      }
      if (!activity) {
        return res.status(400).json({ error: 'Missing required field: activity' })
      }

      // Store timestamp in UTC
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
        return res.status(200).json({ 
          success: false, 
          warning: 'Audit log could not be saved',
          error: error.message 
        })
      }

      return res.status(200).json({ success: true, data })
    }

    // Get audit logs (requires auth)
    if (getAction === 'get' || getAction === 'get-all' || (!getAction && !activity)) {
      const requester = req.user // From auth middleware (only for get operations)
      
      if (!requester) {
        return res.status(401).json({ error: 'Unauthorized: Missing authentication' })
      }

      // Authorization: 
      // - MIS can view all logs
      // - Users can view their own logs
      // - Teachers can view logs for students in their sections
      if (getUserId) {
        if (!canAccessUserData(requester, getUserId)) {
          if (requester.role === 'teacher') {
            const canAccess = await teacherCanAccessStudent(requester, getUserId)
            if (!canAccess) {
              return res.status(403).json({ error: 'Forbidden: Cannot access this user\'s audit logs' })
            }
          } else {
            return res.status(403).json({ error: 'Forbidden: Cannot access this user\'s audit logs' })
          }
        }
      } else {
        // No userId = viewing all logs, only MIS can do this
        if (!hasRole(requester, 'mis')) {
          return res.status(403).json({ error: 'Forbidden: Only MIS can view all audit logs' })
        }
      }

      let query = supabase
        .from('audit_log')
        .select('*')

      // If userId is provided, filter by user
      if (getUserId) {
        query = query.eq('user_id', getUserId)
      }

      const { data, error } = await query.order('timestamp', { ascending: false })

      if (error) {
        console.error('Error fetching audit logs:', error)
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json({ logs: data || [] })
    }

    return res.status(400).json({ error: 'Invalid action. Use "create", "get", or "get-all"' })
  } catch (err) {
    console.error('Audit error:', err)
    return res.status(500).json({ 
      error: err.message || 'Internal server error'
    })
  }
}

// Wrap with authorization for get operations, but allow create without auth
export default async function(req, res) {
  // If it's a create operation, don't require auth
  const action = req.body?.action || req.query?.action
  const hasActivity = !!req.body?.activity
  
  if (action === 'create' || (!action && hasActivity)) {
    // Create operation - no auth required (called from frontend for logging)
    return handler(req, res)
  } else {
    // Get operation - require auth
    // Create a wrapper that calls requireAuth
    const wrappedHandler = requireAuth(handler)
    return wrappedHandler(req, res)
  }
}

