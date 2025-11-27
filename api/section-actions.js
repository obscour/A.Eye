import supabase from '../lib/_supabaseClient.js'
import { randomBytes, randomUUID } from 'crypto'
import { requireAuth, hasRole, teacherCanAccessSection } from '../lib/auth-middleware.js'

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const requester = req.user; // From auth middleware
    const { action, sectionId, teacherId, pinned, name } = req.body

    if (!action || !teacherId) {
      return res.status(400).json({ error: 'Missing action or teacherId' })
    }

    // Authorization: Only teachers can manage sections (or MIS)
    if (!hasRole(requester, ['teacher', 'mis'])) {
      return res.status(403).json({ error: 'Forbidden: Only teachers and MIS can manage sections' });
    }

    // For non-MIS users, verify they own the section (except for create)
    if (requester.role === 'teacher' && action !== 'create') {
      if (!sectionId) {
        return res.status(400).json({ error: 'Missing sectionId' });
      }
      const canAccess = await teacherCanAccessSection(requester, sectionId);
      if (!canAccess) {
        return res.status(403).json({ error: 'Forbidden: Cannot access this section' });
      }
    }

    // For create action, verify teacherId matches requester (unless MIS)
    if (action === 'create' && requester.role === 'teacher' && teacherId !== requester.uuid) {
      return res.status(403).json({ error: 'Forbidden: Can only create sections for yourself' });
    }

    if (action === 'create') {
      if (!name) {
        return res.status(400).json({ error: 'Missing name for create action' })
      }

      // Generate a unique section code (6 characters)
      const code = randomBytes(3).toString('hex').toUpperCase()

      // Create the section
      const { data, error } = await supabase
        .from('sections')
        .insert([{
          teacher_id: teacherId,
          name: name.trim(),
          code: code,
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) {
        console.error('Error creating section:', error)
        return res.status(500).json({ error: error.message })
      }

      // Log audit event for section creation
      try {
        // Store timestamp in UTC (default ISO format)
        const timestamp = new Date().toISOString();
        
        await supabase
          .from('audit_log')
          .insert([{
            id: randomUUID(),
            user_id: teacherId,
            activity: 'SECTION_CREATED',
            details: `Created section: ${name.trim()}`,
            timestamp
          }]);
      } catch (auditError) {
        console.error('Error logging section creation:', auditError);
        // Don't fail the request if audit logging fails
      }

      return res.status(200).json({ section: data })
    }

    if (!sectionId) {
      return res.status(400).json({ error: 'Missing sectionId' })
    }

    // Verify the section belongs to this teacher
    const { data: section, error: checkError } = await supabase
      .from('sections')
      .select('id, teacher_id, name')
      .eq('id', sectionId)
      .single()

    if (checkError || !section) {
      return res.status(404).json({ error: 'Section not found' })
    }

    if (section.teacher_id !== teacherId) {
      return res.status(403).json({ error: 'You do not have permission to modify this section' })
    }

    if (action === 'delete') {
      // Store section name before deletion for audit log
      const sectionName = section.name || sectionId;
      
      // Delete section (cascade will delete section_students automatically)
      const { error } = await supabase
        .from('sections')
        .delete()
        .eq('id', sectionId)

      if (error) {
        console.error('Error deleting section:', error)
        return res.status(500).json({ error: error.message })
      }

      // Log audit event for section deletion
      try {
        // Store timestamp in UTC (default ISO format)
        const timestamp = new Date().toISOString();
        
        await supabase
          .from('audit_log')
          .insert([{
            id: randomUUID(),
            user_id: teacherId,
            activity: 'SECTION_DELETED',
            details: `Deleted section: ${sectionName}`,
            timestamp
          }]);
      } catch (auditError) {
        console.error('Error logging section deletion:', auditError);
        // Don't fail the request if audit logging fails
      }

      return res.status(200).json({ message: 'Section deleted successfully' })
    } else if (action === 'toggle-pin') {
      if (pinned === undefined) {
        return res.status(400).json({ error: 'Missing pinned status' })
      }

      // Update pin status
      const { data, error } = await supabase
        .from('sections')
        .update({ pinned: pinned })
        .eq('id', sectionId)
        .select()
        .single()

      if (error) {
        console.error('Error updating pin status:', error)
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json({ section: data })
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "create", "delete", or "toggle-pin"' })
    }
  } catch (err) {
    console.error('Section action error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

// Wrap with authorization - teachers and MIS
export default requireAuth(handler, {
  requiredRole: ['teacher', 'mis']
});

