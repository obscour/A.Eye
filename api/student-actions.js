import supabase from '../lib/_supabaseClient.js'
import { randomUUID } from 'crypto'
import { requireAuth, hasRole, teacherCanAccessSection } from '../lib/auth-middleware.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const requester = req.user; // From auth middleware
    const { action, sectionId, identifier, studentId } = req.body

    if (!action || !sectionId) {
      return res.status(400).json({ error: 'Missing action or sectionId' })
    }

    // Authorization: Only teachers can manage students in sections (or MIS)
    if (!hasRole(requester, ['teacher', 'mis'])) {
      return res.status(403).json({ error: 'Forbidden: Only teachers and MIS can manage students' });
    }

    // Verify teacher owns the section (unless MIS)
    if (requester.role === 'teacher') {
      const canAccess = await teacherCanAccessSection(requester, sectionId);
      if (!canAccess) {
        return res.status(403).json({ error: 'Forbidden: Cannot access this section' });
      }
    }

    if (action === 'invite') {
      if (!identifier) {
        return res.status(400).json({ error: 'Missing identifier (username or email)' })
      }

      // Find the student by username or email
      const column = identifier.includes('@') ? 'email' : 'username'
      
      const { data: student, error: studentError } = await supabase
        .from('users')
        .select('uuid, username, email')
        .eq(column, identifier)
        .single()

      if (studentError || !student) {
        return res.status(404).json({ error: 'Student not found' })
      }

      // Check if student is already in the section
      const { data: existing, error: checkError } = await supabase
        .from('section_students')
        .select('*')
        .eq('section_id', sectionId)
        .eq('student_id', student.uuid)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing membership:', checkError)
        return res.status(500).json({ error: checkError.message })
      }

      if (existing) {
        return res.status(400).json({ error: 'Student is already in this section' })
      }

      // Add student to section
      const { data, error } = await supabase
        .from('section_students')
        .insert([{
          section_id: sectionId,
          student_id: student.uuid,
          joined_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) {
        console.error('Error adding student to section:', error)
        return res.status(500).json({ error: error.message })
      }

      // Log audit event for student added to section
      try {
        // Get section and teacher info for audit log
        const { data: sectionData } = await supabase
          .from('sections')
          .select('name, teacher_id')
          .eq('id', sectionId)
          .single();
        
        if (sectionData) {
          // Store timestamp in UTC (default ISO format)
          const timestamp = new Date().toISOString();
          
          await supabase
            .from('audit_log')
            .insert([{
              id: randomUUID(),
              user_id: sectionData.teacher_id,
              activity: 'STUDENT_ADDED',
              details: `Added student ${student.username} to section: ${sectionData.name}`,
              timestamp
            }]);
        }
      } catch (auditError) {
        console.error('Error logging student addition:', auditError);
        // Don't fail the request if audit logging fails
      }

      return res.status(200).json({ 
        message: 'Student added to section successfully',
        student: {
          uuid: student.uuid,
          username: student.username,
          email: student.email
        }
      })
    } else if (action === 'remove') {
      if (!studentId) {
        return res.status(400).json({ error: 'Missing studentId' })
      }

      // Remove student from section
      const { error } = await supabase
        .from('section_students')
        .delete()
        .eq('section_id', sectionId)
        .eq('student_id', studentId)

      if (error) {
        console.error('Error removing student from section:', error)
        return res.status(500).json({ error: error.message })
      }

      // Log audit event for student removed from section
      try {
        // Get section, teacher, and student info for audit log
        const { data: sectionData } = await supabase
          .from('sections')
          .select('name, teacher_id')
          .eq('id', sectionId)
          .single();
        
        const { data: studentData } = await supabase
          .from('users')
          .select('username')
          .eq('uuid', studentId)
          .single();
        
        if (sectionData) {
          // Store timestamp in UTC (default ISO format)
          const timestamp = new Date().toISOString();
          
          await supabase
            .from('audit_log')
            .insert([{
              id: randomUUID(),
              user_id: sectionData.teacher_id,
              activity: 'STUDENT_REMOVED',
              details: `Removed student ${studentData?.username || studentId} from section: ${sectionData.name}`,
              timestamp
            }]);
        }
      } catch (auditError) {
        console.error('Error logging student removal:', auditError);
        // Don't fail the request if audit logging fails
      }

      return res.status(200).json({ message: 'Student removed from section successfully' })
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "invite" or "remove"' })
    }
  } catch (err) {
    console.error('Student action error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

// Wrap with authorization - teachers and MIS
export default requireAuth(handler, {
  requiredRole: ['teacher', 'mis']
});

