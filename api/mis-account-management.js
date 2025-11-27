import supabase from '../lib/_supabaseClient.js'
import { randomUUID } from 'crypto'
import { hashPassword } from '../lib/_passwordUtils.js'
import { requireAuth, hasRole } from '../lib/auth-middleware.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const requester = req.user; // From auth middleware

    // Authorization: Only MIS can manage accounts
    if (!hasRole(requester, 'mis')) {
      return res.status(403).json({ error: 'Forbidden: Only MIS can manage accounts' });
    }

    const { action, userId, accountData } = req.body

    if (!action) {
      return res.status(400).json({ error: 'Missing action' })
    }

    // Handle get-students action (MIS only - view all students)
    if (action === 'get-students') {
      const { data: users, error } = await supabase
        .from('users')
        .select('uuid, username, email, role, created_at, first_name, last_name')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching users:', error)
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json({ users: users || [] })
    }

    // Handle get-next-mis-id action
    if (action === 'get-next-mis-id') {
      try {
        // Get all MIS accounts and find the highest MIS ID
        // Use a filter that works with Supabase - get all MIS users first, then filter in code
        const { data: misAccounts, error: misError } = await supabase
          .from('users')
          .select('mis_id')
          .eq('role', 'mis')

        if (misError) {
          console.error('Error fetching MIS accounts:', misError)
          // If mis_id column doesn't exist, start from 1
          return res.status(200).json({ misId: 'MIS001' })
        }

        // Extract numeric part from MIS IDs (assuming format like "MIS001", "MIS002", etc.)
        let maxId = 0
        if (misAccounts && misAccounts.length > 0) {
          misAccounts.forEach(account => {
            if (account.mis_id && typeof account.mis_id === 'string') {
              const match = account.mis_id.match(/\d+$/)
              if (match) {
                const num = parseInt(match[0], 10)
                if (num > maxId) maxId = num
              }
            }
          })
        }

        // Generate next sequential MIS ID
        const nextId = maxId + 1
        const misId = `MIS${String(nextId).padStart(3, '0')}`

        return res.status(200).json({ misId })
      } catch (err) {
        console.error('Error in get-next-mis-id:', err)
        // Return a default ID if there's an error
        return res.status(200).json({ misId: 'MIS001' })
      }
    }

    if (action === 'create') {
      const { username, email, password, role, firstName, lastName, studentId, teacherId, misId } = accountData || {}

      if (!username || !email || !password || !firstName || !lastName || !role) {
        return res.status(400).json({ error: 'Missing required fields: username, email, password, firstName, lastName, role' })
      }

      // Validate role
      if (!['student', 'teacher', 'mis'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be student, teacher, or mis' })
      }

      // Validate ID fields based on role
      if (role === 'student') {
        if (!studentId) {
          return res.status(400).json({ error: 'Student ID is required for student accounts' })
        }
        if (!/^\d{12}$/.test(studentId)) {
          return res.status(400).json({ error: 'Student ID must be exactly 12 digits' })
        }
      } else if (role === 'teacher') {
        if (!teacherId) {
          return res.status(400).json({ error: 'Teacher ID is required for teacher accounts' })
        }
        if (!/^\d{7}$/.test(teacherId)) {
          return res.status(400).json({ error: 'Teacher ID must be exactly 7 digits' })
        }
      } else if (role === 'mis') {
        if (!misId) {
          return res.status(400).json({ error: 'MIS ID is required for MIS accounts' })
        }
        
        // Check MIS account limit (maximum 3)
        const { data: misAccounts, error: misCountError } = await supabase
          .from('users')
          .select('uuid')
          .eq('role', 'mis')
        
        if (misCountError) {
          console.error('Error counting MIS accounts:', misCountError)
        } else {
          const misCount = misAccounts?.length || 0
          if (misCount >= 3) {
            return res.status(400).json({ error: 'Maximum of 3 MIS accounts allowed. Cannot create more MIS accounts.' })
          }
        }
      }

      // Check for existing username or email
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('uuid, username, email')
        .or(`username.eq.${username},email.eq.${email}`)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }
      if (existingUser) {
        return res.status(400).json({ error: 'Username or email already taken' })
      }

      const hashedPassword = await hashPassword(password)

      const userData = {
        uuid: randomUUID(),
        username,
        email,
        password: hashedPassword,
        role,
        first_name: firstName,
        last_name: lastName,
        created_at: new Date().toISOString(),
      }

      // Store IDs separately - these columns need to exist in your Supabase users table
      if (studentId) userData.student_id = studentId
      if (teacherId) userData.teacher_id = teacherId
      if (misId) userData.mis_id = misId

      const initialStats = {}
      for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        initialStats[char] = { streak: 0, correct: 0, mastery: 0, attempts: 0 }
      }

      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single()

      if (error) {
        // If error is about missing columns, provide helpful message
        if (error.message && (error.message.includes('column') || error.message.includes('not found'))) {
          console.error('Database schema error:', error.message)
          return res.status(500).json({ 
            error: 'Database schema error: Missing columns. Please add student_id (text), teacher_id (text), and mis_id (text) columns to your users table in Supabase.',
            details: error.message
          })
        }
        throw error
      }

      // Only create performance history for students (teachers and MIS don't take quizzes)
      if (role === 'student') {
        const { error: historyError } = await supabase
          .from('performance_history')
          .insert([{
            user_id: data.uuid,
            stats: initialStats,
            recorded_at: new Date().toISOString()
          }])

        if (historyError) {
          console.error('Error creating initial performance history:', historyError)
        }
      }

      return res.status(200).json({
        message: 'Account created successfully',
        user: {
          ...data,
          id: data.uuid
        }
      })
    } else if (action === 'update') {
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' })
      }

      const { username, email, password, firstName, lastName, role, studentId, teacherId, misId } = accountData || {}
      const updateData = {}

      // Get current user to check existing role
      const { data: currentUser } = await supabase
        .from('users')
        .select('role')
        .eq('uuid', userId)
        .single()

      const targetRole = role || currentUser?.role

      // Validate role if changing
      if (role && !['student', 'teacher', 'mis'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be student, teacher, or mis' })
      }

      // Validate ID fields based on role
      if (role === 'student' || (targetRole === 'student' && studentId)) {
        if (studentId && !/^\d{12}$/.test(studentId)) {
          return res.status(400).json({ error: 'Student ID must be exactly 12 digits' })
        }
        if (role === 'student' && !studentId) {
          return res.status(400).json({ error: 'Student ID is required when changing to student role' })
        }
      }
      if (role === 'teacher' || (targetRole === 'teacher' && teacherId)) {
        if (teacherId && !/^\d{7}$/.test(teacherId)) {
          return res.status(400).json({ error: 'Teacher ID must be exactly 7 digits' })
        }
        if (role === 'teacher' && !teacherId) {
          return res.status(400).json({ error: 'Teacher ID is required when changing to teacher role' })
        }
      }

      // Update fields - username is separate from IDs
      if (username && username !== currentUser?.username) {
        updateData.username = username
      }
      if (email) updateData.email = email
      if (firstName !== undefined) updateData.first_name = firstName
      if (lastName !== undefined) updateData.last_name = lastName
      if (role) updateData.role = role
      // Store IDs separately - these columns need to exist in your Supabase users table
      if (studentId) updateData.student_id = studentId
      if (teacherId) updateData.teacher_id = teacherId
      if (misId) updateData.mis_id = misId

      if (password) {
        updateData.password = await hashPassword(password)
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No fields to update' })
      }

      if (username || email) {
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('uuid, username, email')
          .or(`username.eq.${username || ''},email.eq.${email || ''}`)
          .neq('uuid', userId)
          .maybeSingle()

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError
        }
        if (existingUser) {
          return res.status(400).json({ error: 'Username or email already taken' })
        }
      }

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('uuid', userId)
        .select()
        .single()

      if (error) {
        // If error is about missing columns, provide helpful message
        if (error.message && error.message.includes('column') && error.message.includes('not found')) {
          console.error('Database schema error:', error.message)
          return res.status(500).json({ 
            error: 'Database schema error: Missing columns. Please add student_id, teacher_id, and mis_id columns to your users table.',
            details: error.message
          })
        }
        throw error
      }

      return res.status(200).json({
        message: 'Account updated successfully',
        user: {
          ...data,
          id: data.uuid
        }
      })
    } else if (action === 'delete') {
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' })
      }

      // Check if the account being deleted is an MIS account
      const { data: userToDelete, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('uuid', userId)
        .single()

      if (userError) {
        return res.status(404).json({ error: 'User not found' })
      }

      // If deleting an MIS account, check minimum limit (minimum 2)
      if (userToDelete?.role === 'mis') {
        const { data: misAccounts, error: misCountError } = await supabase
          .from('users')
          .select('uuid')
          .eq('role', 'mis')
        
        if (misCountError) {
          console.error('Error counting MIS accounts:', misCountError)
        } else {
          const misCount = misAccounts?.length || 0
          if (misCount <= 2) {
            return res.status(400).json({ error: 'Minimum of 2 MIS accounts required. Cannot delete this MIS account.' })
          }
        }
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('uuid', userId)

      if (error) throw error

      return res.status(200).json({ message: 'Account deleted successfully' })
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "create", "update", or "delete"' })
    }
  } catch (err) {
    console.error('MIS account management error:', err)
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}

// Wrap with authorization - MIS only
export default requireAuth(handler, {
  requiredRole: 'mis'
});

