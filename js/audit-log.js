// Audit Log System
// This file handles logging of user activities for teacher monitoring

// Supabase client for audit logs
const supabaseAudit = window.supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.key
);

// Function to get user's IP address (simplified)
async function getUserIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error getting IP:', error);
    return 'Unknown';
  }
}

// Function to log user activity
async function logActivity(activity, details = '', userId = null) {
  try {
    // Get current user if not provided
    if (!userId) {
      const userStr = localStorage.getItem('user');
      const teacherStr = localStorage.getItem('teacher');
      
      if (userStr) {
        const user = JSON.parse(userStr);
        userId = user.id;
      } else if (teacherStr) {
        const teacher = JSON.parse(teacherStr);
        userId = teacher.id;
      } else {
        console.warn('No user found for audit log');
        return;
      }
    }

    const ipAddress = await getUserIP();
    const timestamp = new Date().toISOString();

    // Store in Supabase audit_logs table
    const { data, error } = await supabaseAudit
      .from('audit_logs')
      .insert([{
        id: crypto.randomUUID(),
        user_id: userId,
        activity: activity,
        details: details,
        ip_address: ipAddress,
        timestamp: timestamp
      }])
      .select();

    if (error) {
      console.error('Error saving audit log to database:', error);
      // Fallback to localStorage if database insert fails
      const auditLog = {
        id: crypto.randomUUID(),
        user_id: userId,
        activity: activity,
        details: details,
        ip_address: ipAddress,
        timestamp: timestamp
      };
      const existingLogs = JSON.parse(localStorage.getItem('audit_logs') || '[]');
      existingLogs.push(auditLog);
      if (existingLogs.length > 1000) {
        existingLogs.splice(0, existingLogs.length - 1000);
      }
      localStorage.setItem('audit_logs', JSON.stringify(existingLogs));
    } else {
      console.log('Activity logged to database:', data);
    }
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

// Function to get audit logs for a specific user
async function getAuditLogs(userId) {
  try {
    // Fetch from Supabase database
    const { data, error } = await supabaseAudit
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching audit logs from database:', error);
      // Fallback to localStorage
      const allLogs = JSON.parse(localStorage.getItem('audit_logs') || '[]');
      return allLogs.filter(log => log.user_id === userId);
    }

    // Successfully fetched from database - clear old localStorage logs
    // This removes test/sample logs that were stored locally
    localStorage.removeItem('audit_logs');

    return data || [];
  } catch (error) {
    console.error('Error getting audit logs:', error);
    // Fallback to localStorage
    const allLogs = JSON.parse(localStorage.getItem('audit_logs') || '[]');
    return allLogs.filter(log => log.user_id === userId);
  }
}

// Function to get all audit logs (for admin/teacher view)
async function getAllAuditLogs() {
  try {
    // Fetch from Supabase database
    const { data, error } = await supabaseAudit
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching all audit logs from database:', error);
      // Fallback to localStorage
      return JSON.parse(localStorage.getItem('audit_logs') || '[]');
    }

    // Successfully fetched from database - clear old localStorage logs
    // This removes test/sample logs that were stored locally
    localStorage.removeItem('audit_logs');

    return data || [];
  } catch (error) {
    console.error('Error getting all audit logs:', error);
    // Fallback to localStorage
    return JSON.parse(localStorage.getItem('audit_logs') || '[]');
  }
}

// Export functions for use in other files
window.auditLog = {
  logActivity,
  getAuditLogs,
  getAllAuditLogs
};
