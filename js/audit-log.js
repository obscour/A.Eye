// FRONTEND Audit Log System
// Sends logs to Vercel API instead of using Supabase directly

async function logActivity(activity, details = '', userId = null) {
  try {
    if (!userId) {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      const teacher = JSON.parse(localStorage.getItem('teacher') || 'null');

      if (user) userId = user.id;
      else if (teacher) userId = teacher.id;
      else return;
    }

    await fetch('/api/audit-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        activity,
        details
      })
    });

  } catch (err) {
    console.error('Audit log error:', err);
  }
}

async function getAuditLogs(userId) {
  try {
    if (!userId) {
      console.warn('getAuditLogs called without userId');
      return [];
    }

    const response = await fetch('/api/get-audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch audit logs:', response.status, errorText);
      throw new Error(`Failed to fetch audit logs: ${response.status}`);
    }

    const result = await response.json();
    const logs = result.logs || [];
    console.log(`Retrieved ${logs.length} audit logs for user ${userId}`);
    return logs;
  } catch (err) {
    console.error('Error getting audit logs:', err);
    return [];
  }
}

async function getAllAuditLogs() {
  try {
    const response = await fetch('/api/get-all-audit-logs');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch audit logs: ${response.status}`);
    }

    const result = await response.json();
    return result.logs || [];
  } catch (err) {
    console.error('Error getting all audit logs:', err);
    return [];
  }
}

window.auditLog = {
  logActivity,
  getAuditLogs,
  getAllAuditLogs
};
