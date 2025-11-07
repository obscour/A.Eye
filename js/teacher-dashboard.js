// Supabase client init - uses config from config.js
const supabase = window.supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.key
);

let students = [];
let currentStudent = null;
let auditLogs = [];
let filteredAuditLogs = [];
let displayedLogCount = 25; // Maximum logs to show initially
let currentSort = { column: null, asc: true };

// Function to handle logout
async function logout() {
  try {
    // Get teacher info before clearing
    const teacherStr = localStorage.getItem('teacher');
    const teacher = teacherStr ? JSON.parse(teacherStr) : null;
    
    // Log teacher logout
    if (teacher && window.auditLog) {
      await window.auditLog.logActivity('logout', `Teacher ${teacher.username} logged out`, teacher.id);
    }
    
    localStorage.removeItem('teacher');
    window.location.href = 'index.html';
  } catch (error) {
    alert('Logout failed: ' + (error.message || error));
    console.error('Error signing out:', error.message || error);
  }
}
window.logout = logout;

// Function to check if user is a teacher
function checkTeacherAuth() {
  const teacher = localStorage.getItem('teacher');
  if (!teacher) {
    window.location.href = 'index.html';
    return false;
  }
  return JSON.parse(teacher);
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
    console.log('Loading students...');
    console.log('Supabase client:', supabase);
    
    // Try the simplest possible query first
    let { data, error } = await supabase
      .from('users')
      .select('*');

    console.log('Simple query result:', { data, error });

    if (error) {
      console.error('Simple query failed:', error);
      throw error;
    }

    // Filter for students manually (more reliable)
    const studentUsers = data ? data.filter(user => {
      // Include users with role='student' or no role (default to student)
      return user.role === 'student' || !user.role || user.role === null;
    }) : [];

    console.log('All users:', data);
    console.log('Filtered students:', studentUsers);

    students = studentUsers;
    console.log('Students loaded:', students);
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
    const { data: userData, error } = await supabase
      .from('users')
      .select('stats')
      .eq('uuid', studentId)
      .single();

    if (error) throw error;

    let statsArray = [];
    if (userData && userData.stats) {
      try {
        const statsJson = typeof userData.stats === 'string' ? JSON.parse(userData.stats) : userData.stats;
        
        statsArray = Object.entries(statsJson).map(([char, data]) => ({
          alphanumeric_char: char,
          attempts: data.attempts || 0,
          mastery_score: data.mastery || 0,
          correct_count: data.correct || 0,
          avg_response_time: 0, // Not available in current JSON structure
          streak: data.streak || 0
        }));
      } catch (parseError) {
        console.error('Error parsing stats JSON:', parseError);
        statsArray = [];
      }
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
