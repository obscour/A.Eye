let students = [];
let currentStudent = null;
let auditLogs = [];
let filteredAuditLogs = [];
let displayedLogCount = 25; // Maximum logs to show initially
let currentSort = { column: null, asc: true };

// Function to handle logout
async function logout() {
  try {
    // Get teacher info before clearing (check both keys)
    let teacher = localStorage.getItem('teacher');
    if (!teacher) {
      const user = localStorage.getItem('user');
      if (user) {
        const userData = JSON.parse(user);
        if (userData.role === 'teacher') {
          teacher = user;
        }
      }
    }
    
    const teacherData = teacher ? JSON.parse(teacher) : null;
    
    // Log teacher logout
    if (teacherData && window.auditLog) {
      await window.auditLog.logActivity('logout', `Teacher ${teacherData.username} logged out`, teacherData.id);
    }
    
    // Clear both keys
    localStorage.removeItem('teacher');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  } catch (error) {
    alert('Logout failed: ' + (error.message || error));
    console.error('Error signing out:', error.message || error);
  }
}
window.logout = logout;

// Function to check if user is a teacher
function checkTeacherAuth() {
  // Check for 'teacher' key first (for compatibility)
  let teacher = localStorage.getItem('teacher');
  if (teacher) {
    return JSON.parse(teacher);
  }
  
  // Also check 'user' key with role='teacher'
  const user = localStorage.getItem('user');
  if (user) {
    const userData = JSON.parse(user);
    if (userData.role === 'teacher') {
      // Store in 'teacher' key for consistency
      localStorage.setItem('teacher', JSON.stringify(userData));
      return userData;
    }
  }
  
  // No teacher found, redirect to login
  window.location.href = 'index.html';
  return false;
}

// Function to display teacher name
function displayTeacherName() {
  const teacher = checkTeacherAuth();
  if (teacher) {
    document.getElementById('teacherName').textContent = `Welcome, ${teacher.username}`;
  }
}

// Function to load all students
async function loadStudents() {
  try {
    const response = await fetch('/api/get-students');
    
    if (!response.ok) {
      throw new Error(`Failed to load students: ${response.status}`);
    }

    const result = await response.json();
    students = result.students || [];
    
    populateStudentSelect();
  } catch (error) {
    console.error('Error loading students:', error);
    alert('Failed to load students: ' + error.message);
    
    // Show a fallback message in the dropdown
    const select = document.getElementById('studentSelect');
    if (select) {
      select.innerHTML = '<option value="">Error loading students</option>';
    }
  }
}

// Function to populate student select dropdown
function populateStudentSelect() {
  const select = document.getElementById('studentSelect');
  select.innerHTML = '<option value="">Choose a student...</option>';
  
  console.log('Populating student select with:', students);
  
  students.forEach(student => {
    const option = document.createElement('option');
    option.value = student.uuid;
    option.textContent = `${student.username} (${student.email})`;
    select.appendChild(option);
    console.log('Added student option:', student.username);
  });
  
  console.log('Total options in select:', select.options.length);
}

// Function to refresh student list
async function refreshStudentList() {
  await loadStudents();
}

// Function to load student data when selected
async function loadStudentData() {
  const studentId = document.getElementById('studentSelect').value;
  if (!studentId) {
    hideStudentSections();
    return;
  }

  currentStudent = students.find(s => s.uuid === studentId);
  if (!currentStudent) return;

  document.getElementById('selectedStudentName').textContent = currentStudent.username;
  document.getElementById('studentProgressSection').style.display = 'block';
  document.getElementById('auditLogSection').style.display = 'block';

  await Promise.all([
    loadStudentStats(studentId),
    loadAuditLogs(studentId)
  ]);
}

// Function to hide student sections
function hideStudentSections() {
  document.getElementById('studentProgressSection').style.display = 'none';
  document.getElementById('auditLogSection').style.display = 'none';
}

// Function to load student statistics
async function loadStudentStats(studentId) {
  try {
    const response = await fetch('/api/get-user-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: studentId })
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

    renderStudentStatsTable(statsArray);
  } catch (error) {
    console.error('Error loading student stats:', error);
    document.getElementById('studentStatsBody').innerHTML = 
      `<tr><td colspan="6" class="text-danger text-center">Error loading stats: ${error.message}</td></tr>`;
  }
}

// Function to render student stats table
function renderStudentStatsTable(stats) {
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
async function loadAuditLogs(studentId) {
  try {
    // Get audit logs from the audit log system
    if (window.auditLog) {
      auditLogs = await window.auditLog.getAuditLogs(studentId);
    } else {
      // Fallback to empty array if audit log system not available
      auditLogs = [];
    }
    
    // Sort logs by timestamp (newest first)
    auditLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Reset displayed count and apply current filter
    displayedLogCount = 25;
    applyAuditLogFilter();
  } catch (error) {
    console.error('Error loading audit logs:', error);
    document.getElementById('auditLogBody').innerHTML = 
      `<tr><td colspan="4" class="text-danger text-center">Error loading audit logs: ${error.message}</td></tr>`;
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
        <td>${log.ip_address}</td>
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
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">No audit logs found.</td></tr>';
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
  if (currentStudent) {
    await loadAuditLogs(currentStudent.uuid);
  }
}

// Function to sort and render student stats
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
  
  renderStudentStatsTable(data);
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

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  const teacher = checkTeacherAuth();
  if (!teacher) return;

  displayTeacherName();
  loadStudents();

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
