// Authorization Middleware for API Routes
// Verifies user identity and role before allowing access

import supabase from './_supabaseClient.js'

/**
 * Verify user identity and get their role
 * @param {string} userId - User ID from request
 * @returns {Object|null} - User object with role, or null if invalid
 */
export async function verifyUser(userId) {
  if (!userId) return null

  try {
    const { data, error } = await supabase
      .from('users')
      .select('uuid, role, username, email')
      .eq('uuid', userId)
      .single()

    if (error || !data) return null
    return data
  } catch (err) {
    console.error('Error verifying user:', err)
    return null
  }
}

/**
 * Check if user has required role
 * @param {Object} user - User object from verifyUser
 * @param {string|string[]} requiredRoles - Required role(s)
 * @returns {boolean}
 */
export function hasRole(user, requiredRoles) {
  if (!user || !user.role) return false
  if (Array.isArray(requiredRoles)) {
    return requiredRoles.includes(user.role)
  }
  return user.role === requiredRoles
}

/**
 * Check if user can access another user's data
 * @param {Object} requester - User making the request
 * @param {string} targetUserId - User ID being accessed
 * @returns {boolean}
 */
export function canAccessUserData(requester, targetUserId) {
  if (!requester || !targetUserId) return false
  
  // Users can always access their own data
  if (requester.uuid === targetUserId) return true
  
  // MIS can access all user data
  if (requester.role === 'mis') return true
  
  // Teachers can access their students' data (checked separately via sections)
  // Students cannot access other students' data
  return false
}

/**
 * Check if teacher can access a section
 * @param {Object} teacher - Teacher user object
 * @param {string} sectionId - Section ID
 * @returns {Promise<boolean>}
 */
export async function teacherCanAccessSection(teacher, sectionId) {
  if (!teacher || teacher.role !== 'teacher') return false
  if (!sectionId) return false

  try {
    const { data, error } = await supabase
      .from('sections')
      .select('teacher_id')
      .eq('id', sectionId)
      .eq('teacher_id', teacher.uuid)
      .single()

    return !error && !!data
  } catch (err) {
    console.error('Error checking section access:', err)
    return false
  }
}

/**
 * Check if teacher can access a student (student is in teacher's section)
 * @param {Object} teacher - Teacher user object
 * @param {string} studentId - Student ID
 * @returns {Promise<boolean>}
 */
export async function teacherCanAccessStudent(teacher, studentId) {
  if (!teacher || teacher.role !== 'teacher') return false
  if (!studentId) return false

  try {
    const { data, error } = await supabase
      .from('section_students')
      .select('section_id')
      .eq('student_id', studentId)
      .limit(1)
      .single()

    if (error || !data) return false

    // Check if teacher owns this section
    return await teacherCanAccessSection(teacher, data.section_id)
  } catch (err) {
    console.error('Error checking student access:', err)
    return false
  }
}

/**
 * Authorization middleware wrapper
 * @param {Function} handler - API route handler
 * @param {Object} options - Authorization options
 * @param {string|string[]} options.requiredRole - Required role(s)
 * @param {boolean} options.requireOwnData - Require user to access their own data
 * @param {Function} options.customCheck - Custom authorization function
 */
export function requireAuth(handler, options = {}) {
  return async (req, res) => {
    try {
      // Get requester's userId from request body or headers
      // Priority: requesterUserId > userId (if no requesterUserId, assume userId is the requester)
      const requesterUserId = req.body?.requesterUserId || req.body?.userId || req.headers['x-user-id']
      
      if (!requesterUserId) {
        return res.status(401).json({ error: 'Unauthorized: Missing user ID' })
      }

      // Verify requester exists and get their role
      const user = await verifyUser(requesterUserId)
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Invalid user' })
      }
      
      // If requesterUserId was provided separately, keep userId as target
      // Otherwise, userId is the requester
      if (req.body?.requesterUserId && req.body?.userId && req.body.userId !== req.body.requesterUserId) {
        // Target user is different from requester - will be checked in customCheck
      } else if (req.body?.requesterUserId) {
        // requesterUserId provided, but no separate userId - requester is accessing their own data
        req.body.userId = req.body.requesterUserId
      }

      // Check required role
      if (options.requiredRole) {
        if (!hasRole(user, options.requiredRole)) {
          return res.status(403).json({ 
            error: 'Forbidden: Insufficient permissions',
            required: options.requiredRole,
            current: user.role
          })
        }
      }

      // Check if accessing own data
      if (options.requireOwnData) {
        const targetUserId = req.body?.targetUserId || req.body?.userId
        if (!canAccessUserData(user, targetUserId)) {
          return res.status(403).json({ 
            error: 'Forbidden: Cannot access this user\'s data' 
          })
        }
      }

      // Custom authorization check
      if (options.customCheck) {
        const allowed = await options.customCheck(user, req)
        if (!allowed) {
          return res.status(403).json({ error: 'Forbidden: Custom check failed' })
        }
      }

      // Add user to request object for handler to use
      req.user = user
      
      // Call the original handler
      return handler(req, res)
    } catch (err) {
      console.error('Auth middleware error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}

