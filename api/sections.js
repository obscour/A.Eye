// Consolidated sections API - handles getting sections and section students
import supabase from '../lib/_supabaseClient.js'
import { requireAuth, hasRole, teacherCanAccessSection } from '../lib/auth-middleware.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { action, teacherId, sectionId, all } = req.body
    const requester = req.user // From auth middleware

    if (!action) {
      return res.status(400).json({ error: 'Missing action. Use "get-sections" or "get-students"' })
    }

    if (action === 'get-sections') {
      // Authorization: Only MIS can use all=true
      if (all === 'true' || all === true) {
        if (!hasRole(requester, 'mis')) {
          return res.status(403).json({ error: 'Forbidden: Only MIS can view all sections' })
        }
      } else {
        // Teachers can only view their own sections
        if (requester.role === 'teacher') {
          if (!teacherId || teacherId !== requester.uuid) {
            return res.status(403).json({ error: 'Forbidden: Can only view your own sections' })
          }
        } else if (requester.role !== 'mis') {
          return res.status(403).json({ error: 'Forbidden: Only teachers and MIS can view sections' })
        }
      }

      let query = supabase
        .from('sections')
        .select('*')

      // If all=true, get all sections with teacher info (for MIS)
      if (all === 'true' || all === true) {
        query = supabase
          .from('sections')
          .select(`
            *,
            users!sections_teacher_id_fkey (
              uuid,
              username,
              email
            )
          `)
          .order('created_at', { ascending: false })
      } else {
        // Get sections for specific teacher
        if (!teacherId) {
          return res.status(400).json({ error: 'Missing teacherId' })
        }
        query = query
          .eq('teacher_id', teacherId)
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false })
      }

      const { data: sections, error } = await query

      if (error) {
        console.error('Error fetching sections:', error)
        return res.status(500).json({ error: error.message })
      }

      // Get student count for each section
      const sectionsWithCounts = await Promise.all(
        (sections || []).map(async (section) => {
          const { count, error: countError } = await supabase
            .from('section_students')
            .select('*', { count: 'exact', head: true })
            .eq('section_id', section.id)
          
          if (countError) {
            console.error('Error counting students:', countError)
          }
          
          const result = {
            ...section,
            student_count: count || 0
          }

          // If getting all sections, include teacher info
          if (all === 'true' || all === true) {
            result.teacher = section.users || null
          }
          
          return result
        })
      )

      return res.status(200).json({ sections: sectionsWithCounts })
    }

    if (action === 'get-students') {
      if (!sectionId) {
        return res.status(400).json({ error: 'Missing sectionId' })
      }

      // Authorization: Only teachers who own the section, or MIS, can view students
      if (requester.role !== 'mis') {
        if (requester.role !== 'teacher') {
          return res.status(403).json({ error: 'Forbidden: Only teachers and MIS can view section students' })
        }
        
        const canAccess = await teacherCanAccessSection(requester, sectionId)
        if (!canAccess) {
          return res.status(403).json({ error: 'Forbidden: Cannot access this section\'s students' })
        }
      }

      // Get all students in this section
      const { data, error } = await supabase
        .from('section_students')
        .select(`
          joined_at,
          users:student_id (
            uuid,
            username,
            email,
            first_name,
            last_name
          )
        `)
        .eq('section_id', sectionId)

      if (error) {
        console.error('Error fetching section students:', error)
        return res.status(500).json({ error: error.message })
      }

      // Transform the data to a simpler format
      const students = (data || []).map(item => ({
        uuid: item.users?.uuid,
        username: item.users?.username,
        email: item.users?.email,
        first_name: item.users?.first_name,
        last_name: item.users?.last_name,
        joined_at: item.joined_at
      })).filter(s => s.uuid) // Filter out any null entries

      return res.status(200).json({ students })
    }

    return res.status(400).json({ error: 'Invalid action. Use "get-sections" or "get-students"' })
  } catch (err) {
    console.error('Sections error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

// Wrap with authorization - teachers and MIS
export default requireAuth(handler, {
  requiredRole: ['teacher', 'mis']
})

