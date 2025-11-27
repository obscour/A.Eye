// API Helper - Ensures all API calls include requester's userId for authorization

/**
 * Get the current logged-in user's ID
 */
function getCurrentUserId() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const teacher = JSON.parse(localStorage.getItem('teacher') || 'null');
    const mis = JSON.parse(localStorage.getItem('mis') || 'null');
    const admin = JSON.parse(localStorage.getItem('admin') || 'null');
    
    if (user) return user.id || user.uuid;
    if (teacher) return teacher.id || teacher.uuid;
    if (mis) return mis.id || mis.uuid;
    if (admin) return admin.id || admin.uuid;
    
    return null;
  } catch (err) {
    console.error('Error getting current user ID:', err);
    return null;
  }
}

/**
 * Make an authenticated API call
 * Automatically includes requesterUserId for authorization
 */
async function authenticatedFetch(url, options = {}) {
  const requesterUserId = getCurrentUserId();
  
  if (!requesterUserId) {
    throw new Error('Not authenticated. Please log in.');
  }

  // Ensure body is an object
  const body = options.body ? JSON.parse(options.body) : {};
  
  // Add requesterUserId to body
  body.requesterUserId = requesterUserId;
  
  // Update options
  const updatedOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: JSON.stringify(body)
  };

  return fetch(url, updatedOptions);
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.getCurrentUserId = getCurrentUserId;
  window.authenticatedFetch = authenticatedFetch;
}

