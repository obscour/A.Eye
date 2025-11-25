let users = [];
let currentUser = null;
let auditLogs = [];
let filteredAuditLogs = [];
let displayedLogCount = 25; // Maximum logs to show initially
let currentSort = { column: null, asc: true };

// Function to handle logout
async function logout() {
  try {
    // Get admin info before clearing (check both keys)
    let admin = localStorage.getItem('admin');
    if (!admin) {
      const user = localStorage.getItem('user');
      if (user) {
        const userData = JSON.parse(user);
        if (userData.role === 'admin') {
          admin = user;
        }
      }
    }
    
    const adminData = admin ? JSON.parse(admin) : null;
    
    // Log admin logout
    if (adminData && window.auditLog) {
      await window.auditLog.logActivity('logout', `Admin ${adminData.username} logged out`, adminData.id);
    }
    
    // Clear both keys
    localStorage.removeItem('admin');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  } catch (error) {
    alert('Logout failed: ' + (error.message || error));
    console.error('Error signing out:', error.message || error);
  }
}
window.logout = logout;

// Function to check if user is an admin
function checkAdminAuth() {
  // Check for 'admin' key first (for compatibility)
  let admin = localStorage.getItem('admin');
  if (admin) {
    return JSON.parse(admin);
  }
  
  // Also check 'user' key with role='admin'
  const user = localStorage.getItem('user');
  if (user) {
    const userData = JSON.parse(user);
    if (userData.role === 'admin') {
      // Store in 'admin' key for consistency
      localStorage.setItem('admin', JSON.stringify(userData));
      return userData;
    }
  }
  
  // No admin found, redirect to login
  window.location.href = 'index.html';
  return false;
}

// Helper function to format user name as last_name, first_name (email)
function formatUserName(user) {
  if (user.last_name && user.first_name) {
    return `${user.last_name}, ${user.first_name} (${user.email || user.username})`;
  } else if (user.first_name) {
    return `${user.first_name} (${user.email || user.username})`;
  } else if (user.last_name) {
    return `${user.last_name} (${user.email || user.username})`;
  } else {
    return user.email || user.username || 'Unknown';
  }
}

// Function to display admin name
function displayAdminName() {
  const admin = checkAdminAuth();
  if (admin) {
    const formattedName = formatUserName(admin);
    document.getElementById('adminName').textContent = `Welcome, ${formattedName}`;
  }
}

// Function to load all users
async function loadUsers() {
  try {
    const response = await fetch('/api/get-students');
    
    if (!response.ok) {
      throw new Error(`Failed to load users: ${response.status}`);
    }

    const result = await response.json();
    users = result.users || [];
    
    populateUserSelect();
  } catch (error) {
    console.error('Error loading users:', error);
    alert('Failed to load users: ' + error.message);
    
    // Show a fallback message in the dropdown
    const select = document.getElementById('userSelect');
    if (select) {
      select.innerHTML = '<option value="">Error loading users</option>';
    }
  }
}

// Function to populate user select dropdown
function populateUserSelect() {
  const select = document.getElementById('userSelect');
  select.innerHTML = '<option value="">Choose a user...</option>';
  
  console.log('Populating user select with:', users);
  
  users.forEach(user => {
    const option = document.createElement('option');
    option.value = user.uuid;
    // Format name as last_name, first_name (email)
    const formattedName = formatUserName(user);
    option.textContent = formattedName;
    // Include creation date in tooltip
    option.title = user.created_at 
      ? `Account created: ${new Date(user.created_at).toLocaleString()}` 
      : formattedName;
    select.appendChild(option);
    console.log('Added user option:', formattedName);
  });
  
  console.log('Total options in select:', select.options.length);
}

// Function to refresh user list
async function refreshUserList() {
  await loadUsers();
}

// Function to load user data when selected
async function loadUserData() {
  const userId = document.getElementById('userSelect').value;
  if (!userId) {
    hideUserSections();
    return;
  }

  currentUser = users.find(u => u.uuid === userId);
  if (!currentUser) return;

  // Format name as last_name, first_name (email)
  const formattedName = formatUserName(currentUser);
  document.getElementById('selectedUserName').textContent = formattedName;
  
  // Display account creation date if available
  const createdBadge = document.getElementById('selectedUserCreated');
  if (currentUser.created_at) {
    const createdDate = new Date(currentUser.created_at);
    createdBadge.textContent = `Joined: ${createdDate.toLocaleDateString()}`;
    createdBadge.title = `Account created: ${createdDate.toLocaleString()}`;
    createdBadge.style.display = 'inline-block';
  } else {
    createdBadge.style.display = 'none';
  }
  
  document.getElementById('studentProgressSection').style.display = 'block';
  document.getElementById('auditLogSection').style.display = 'block';

  await Promise.all([
    loadUserStats(userId),
    loadAuditLogs(userId)
  ]);
}

// Function to hide user sections
function hideUserSections() {
  document.getElementById('studentProgressSection').style.display = 'none';
  document.getElementById('auditLogSection').style.display = 'none';
}

// Function to load user statistics
async function loadUserStats(userId) {
  try {
    const response = await fetch('/api/get-user-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) {
      throw new Error(`Failed to load stats: ${response.status}`);
    }

    const result = await response.json();
    const userData = result.data;

    let statsArray = [];
    if (userData && userData.stats) {
      const statsJson = typeof userData.stats === 'string' 
        ? JSON.parse(userData.stats) 
        : userData.stats;
      
      statsArray = Object.entries(statsJson).map(([char, data]) => ({
        alphanumeric_char: char,
        attempts: data.attempts || 0,
        mastery_score: data.mastery || 0,
        correct_count: data.correct || 0,
        avg_response_time: 0,
        streak: data.streak || 0
      }));
    }

    renderUserStatsTable(statsArray);
  } catch (error) {
    console.error('Error loading user stats:', error);
    document.getElementById('studentStatsBody').innerHTML = 
      `<tr><td colspan="6" class="text-danger text-center">Error loading stats: ${error.message}</td></tr>`;
  }
}

// Function to render user stats table
function renderUserStatsTable(stats) {
  const tbody = document.getElementById('studentStatsBody');
  tbody.innerHTML = '';
  
  if (stats && stats.length > 0) {
    stats.forEach(row => {
      tbody.innerHTML += `<tr>
        <td>${row.alphanumeric_char}</td>
        <td>${row.attempts}</td>
        <td>${row.mastery_score}</td>
        <td>${row.correct_count}</td>
        <td>${row.avg_response_time}</td>
        <td>${row.streak || 0}</td>
      </tr>`;
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No data found.</td></tr>';
  }
}

// Function to load audit logs
async function loadAuditLogs(userId) {
  try {
    console.log('Loading audit logs for user:', userId);
    
    // Get audit logs from the audit log system
    if (window.auditLog) {
      auditLogs = await window.auditLog.getAuditLogs(userId);
      console.log('Audit logs received:', auditLogs);
    } else {
      console.warn('Audit log system not available');
      auditLogs = [];
    }
    
    if (!auditLogs || auditLogs.length === 0) {
      console.log('No audit logs found for this user');
      document.getElementById('auditLogBody').innerHTML = 
        '<tr><td colspan="3" class="text-center">No audit logs found for this user.</td></tr>';
      document.getElementById('showMoreContainer').style.display = 'none';
      return;
    }
    
    // Sort logs by timestamp (newest first)
    auditLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Reset displayed count and apply current filter
    displayedLogCount = 25;
    applyAuditLogFilter();
  } catch (error) {
    console.error('Error loading audit logs:', error);
    document.getElementById('auditLogBody').innerHTML = 
      `<tr><td colspan="3" class="text-danger text-center">Error loading audit logs: ${error.message}</td></tr>`;
    document.getElementById('showMoreContainer').style.display = 'none';
  }
}

// Function to render audit log table
function renderAuditLogTable(logs) {
  const tbody = document.getElementById('auditLogBody');
  const showMoreContainer = document.getElementById('showMoreContainer');
  const logCount = document.getElementById('logCount');
  
  tbody.innerHTML = '';
  
  if (logs && logs.length > 0) {
    // Show only the first displayedLogCount entries
    const logsToShow = logs.slice(0, displayedLogCount);
    
    logsToShow.forEach(log => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      const activityBadge = getActivityBadge(log.activity);
      
      tbody.innerHTML += `<tr>
        <td>${timestamp}</td>
        <td>${activityBadge}</td>
        <td>${log.details}</td>
      </tr>`;
    });
    
    // Show/hide "Show More" button based on whether there are more logs
    if (logs.length > displayedLogCount) {
      showMoreContainer.style.display = 'block';
      logCount.textContent = `Showing ${displayedLogCount} of ${logs.length} logs`;
    } else {
      showMoreContainer.style.display = 'none';
      logCount.textContent = `Showing all ${logs.length} logs`;
    }
  } else {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">No audit logs found.</td></tr>';
    showMoreContainer.style.display = 'none';
  }
}

// Function to get activity badge
function getActivityBadge(activity) {
  const badges = {
    login: '<span class="badge bg-success">Login</span>',
    quiz: '<span class="badge bg-primary">Quiz</span>',
    logout: '<span class="badge bg-warning">Logout</span>'
  };
  return badges[activity] || `<span class="badge bg-secondary">${activity}</span>`;
}

// Function to apply audit log filter
function applyAuditLogFilter() {
  const filter = document.getElementById('logFilter').value;
  
  if (filter !== 'all') {
    filteredAuditLogs = auditLogs.filter(log => log.activity === filter);
  } else {
    filteredAuditLogs = auditLogs;
  }
  
  renderAuditLogTable(filteredAuditLogs);
}

// Function to filter audit log
function filterAuditLog() {
  displayedLogCount = 25; // Reset to initial count when filtering
  applyAuditLogFilter();
}

// Function to show more logs
function showMoreLogs() {
  displayedLogCount += 25; // Show 25 more logs
  renderAuditLogTable(filteredAuditLogs);
}

// Function to refresh audit log
async function refreshAuditLog() {
  if (currentUser) {
    await loadAuditLogs(currentUser.uuid);
  }
}

// Function to sort and render user stats
function sortAndRender(column) {
  if (currentSort.column === column) {
    currentSort.asc = !currentSort.asc;
  } else {
    currentSort.column = column;
    currentSort.asc = true;
  }
  
  // Get current stats data and sort
  const tbody = document.getElementById('studentStatsBody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const data = rows.map(row => {
    const cells = row.querySelectorAll('td');
    return {
      alphanumeric_char: cells[0]?.textContent,
      attempts: parseInt(cells[1]?.textContent) || 0,
      mastery_score: parseInt(cells[2]?.textContent) || 0,
      correct_count: parseInt(cells[3]?.textContent) || 0,
      avg_response_time: parseInt(cells[4]?.textContent) || 0,
      streak: parseInt(cells[5]?.textContent) || 0
    };
  }).filter(row => row.alphanumeric_char); // Filter out empty rows

  data.sort((a, b) => {
    if (a[column] == null) return 1;
    if (b[column] == null) return -1;
    if (typeof a[column] === 'number' && typeof b[column] === 'number') {
      return currentSort.asc ? a[column] - b[column] : b[column] - a[column];
    }
    return currentSort.asc
      ? String(a[column]).localeCompare(String(b[column]))
      : String(b[column]).localeCompare(String(a[column]));
  });
  
  renderUserStatsTable(data);
  updateSortIndicators();
}

// Update sort indicators
function updateSortIndicators() {
  document.querySelectorAll('#studentStatsTable th.sortable').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.column === currentSort.column) {
      th.classList.add(currentSort.asc ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

// Function to show edit credentials modal
function showEditCredentialsModal() {
  if (!currentUser) {
    alert('Please select a user first');
    return;
  }

  // Populate modal with current user data
  document.getElementById('editUsername').value = currentUser.username || '';
  document.getElementById('editEmail').value = currentUser.email || '';
  document.getElementById('editPassword').value = '';

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('editCredentialsModal'));
  modal.show();
}

// Function to save credentials
async function saveCredentials() {
  if (!currentUser) {
    alert('No user selected');
    return;
  }

  const username = document.getElementById('editUsername').value.trim();
  const email = document.getElementById('editEmail').value.trim();
  const password = document.getElementById('editPassword').value.trim();

  // Build update object (only include non-empty fields)
  const updateData = {};
  if (username) updateData.username = username;
  if (email) updateData.email = email;
  if (password) updateData.password = password;

  if (Object.keys(updateData).length === 0) {
    alert('Please enter at least one field to update');
    return;
  }

  try {
    const response = await fetch('/api/mis-account-management', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        userId: currentUser.uuid,
        accountData: updateData
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to update credentials');
    }

    // Update current user object
    if (updateData.username) currentUser.username = updateData.username;
    if (updateData.email) currentUser.email = updateData.email;

    // Update user list
    const userIndex = users.findIndex(u => u.uuid === currentUser.uuid);
    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], ...updateData };
      populateUserSelect();
    }

    // Update displayed name
    document.getElementById('selectedUserName').textContent = currentUser.username;

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('editCredentialsModal'));
    modal.hide();

    // Show success message
    alert('Credentials updated successfully!');

    // Log the activity
    if (window.auditLog) {
      const admin = checkAdminAuth();
      await window.auditLog.logActivity(
        'credentials_updated',
        `Admin ${admin.username} updated credentials for user ${currentUser.username}`,
        admin.id
      );
    }
  } catch (error) {
    console.error('Error updating credentials:', error);
    alert('Failed to update credentials: ' + error.message);
  }
}

window.showEditCredentialsModal = showEditCredentialsModal;
window.saveCredentials = saveCredentials;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  const admin = checkAdminAuth();
  if (!admin) return;

  displayAdminName();
  loadUsers();

  // Attach sorting event listeners
  document.querySelectorAll('#studentStatsTable th.sortable').forEach(th => {
    th.addEventListener('click', function() {
      sortAndRender(th.dataset.column);
    });
  });
});

// Add CSS for sort indicators
const style = document.createElement('style');
style.innerHTML = `
  th.sortable { cursor: pointer; user-select: none; }
  th.sortable.sorted-asc:after { content: ' \\25B2'; color: #007bff; }
  th.sortable.sorted-desc:after { content: ' \\25BC'; color: #007bff; }
`;
document.head.appendChild(style);

