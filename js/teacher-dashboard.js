let sections = [];
let filteredSections = [];
let currentSection = null;
let sectionStudents = [];
let currentStudent = null;
let currentSort = { column: null, asc: true };

// Function to handle logout
async function logout() {
  try {
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
    
    if (teacherData && window.auditLog) {
      await window.auditLog.logActivity('logout', `Teacher ${teacherData.username} logged out`, teacherData.id);
    }
    
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
  let teacher = localStorage.getItem('teacher');
  if (teacher) {
    return JSON.parse(teacher);
  }
  
  const user = localStorage.getItem('user');
  if (user) {
    const userData = JSON.parse(user);
    if (userData.role === 'teacher') {
      localStorage.setItem('teacher', JSON.stringify(userData));
      return userData;
    }
  }
  
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

// Function to load all sections for the teacher
async function loadSections() {
  try {
    const teacher = checkTeacherAuth();
    if (!teacher) return;

    const response = await fetch('/api/get-sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: teacher.id })
    });

    if (!response.ok) {
      throw new Error(`Failed to load sections: ${response.status}`);
    }

    const result = await response.json();
    sections = result.sections || [];
    filteredSections = [];
    
    // Apply current sort
    sortSections();
    renderSections();
  } catch (error) {
    console.error('Error loading sections:', error);
    const tbody = document.getElementById('sectionsList');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading sections: ' + error.message + '</td></tr>';
    document.getElementById('sectionContentEmpty').style.display = 'block';
  }
}

// Function to render sections list
function renderSections() {
  const tbody = document.getElementById('sectionsList');
  const noSectionsMsg = document.getElementById('noSectionsMessage');
  tbody.innerHTML = '';

  // Use filtered sections if available, otherwise use all sections
  const sectionsToRender = filteredSections.length > 0 ? filteredSections : sections;

  if (sectionsToRender.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No sections found.</td></tr>';
    noSectionsMsg.style.display = sections.length === 0 ? 'block' : 'none';
    return;
  }

  noSectionsMsg.style.display = 'none';

  sectionsToRender.forEach(section => {
    const row = document.createElement('tr');
    const isPinned = section.pinned || false;
    const pinIcon = isPinned ? '📌' : '';
    
            row.innerHTML = `
      <td class="text-center" style="font-size: 1.2rem;">
        ${pinIcon}
      </td>
      <td>
        <strong class="fw-semibold">${section.name}</strong>
      </td>
      <td>
        <code class="text-primary">${section.code}</code>
      </td>
      <td>
        <span class="badge bg-primary">${section.student_count || 0} student${section.student_count !== 1 ? 's' : ''}</span>
      </td>
      <td class="text-end" onclick="event.stopPropagation()">
        <div class="dropdown">
          <button class="btn btn-sm btn-outline-secondary" type="button" id="sectionMenu${section.id}" data-bs-toggle="dropdown" aria-expanded="false" style="border: none; padding: 0.25rem 0.5rem;">
            <span style="font-size: 1.2rem;">☰</span>
          </button>
          <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="sectionMenu${section.id}">
            <li>
              <a class="dropdown-item" href="#" onclick="event.preventDefault(); togglePinSection('${section.id}', ${!isPinned}); return false;">
                ${isPinned ? 'Unpin Section' : 'Pin Section'}
              </a>
            </li>
            <li><hr class="dropdown-divider"></li>
            <li>
              <a class="dropdown-item text-danger" href="#" onclick="event.preventDefault(); deleteSection('${section.id}', '${section.name.replace(/'/g, "\\'")}'); return false;">
                Delete Section
              </a>
            </li>
          </ul>
        </div>
      </td>
    `;
    
    // Make row clickable to open section (but not when clicking dropdown)
    row.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown')) {
        openSection(section.id);
      }
    });
    
    tbody.appendChild(row);
  });
}

// Function to filter sections
function filterSections() {
  const searchTerm = document.getElementById('sectionSearch').value.toLowerCase().trim();
  
  if (!searchTerm) {
    filteredSections = [];
    renderSections();
    return;
  }

  filteredSections = sections.filter(section => 
    section.name.toLowerCase().includes(searchTerm) ||
    section.code.toLowerCase().includes(searchTerm)
  );

  renderSections();
}

// Function to sort sections
function sortSections() {
  const sortValue = document.getElementById('sectionSort').value;
  
  const sorted = [...sections].sort((a, b) => {
    // Pinned sections always come first (except when sorting by pinned explicitly)
    if (sortValue !== 'pinned') {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
    }
    
    if (sortValue === 'pinned') {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return a.name.localeCompare(b.name);
    }
    
    const [field, direction] = sortValue.split('-');
    let comparison = 0;
    
    switch(field) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'students':
        comparison = (a.student_count || 0) - (b.student_count || 0);
        break;
      case 'date':
        comparison = new Date(a.created_at) - new Date(b.created_at);
        break;
    }
    
    return direction === 'desc' ? -comparison : comparison;
  });

  sections = sorted;
  filterSections(); // Re-apply filter if active
}

// Function to toggle pin status
async function togglePinSection(sectionId, pinStatus) {
  try {
    const teacher = checkTeacherAuth();
    if (!teacher) return;

    const response = await fetch('/api/section-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'toggle-pin',
        sectionId: sectionId,
        teacherId: teacher.id,
        pinned: pinStatus
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to update pin status');
    }

    // Update local sections array
    const section = sections.find(s => s.id === sectionId);
    if (section) {
      section.pinned = pinStatus;
    }

    // Reload sections to reflect changes
    await loadSections();

    // Log activity
    if (window.auditLog) {
      await window.auditLog.logActivity('section_pinned', `${pinStatus ? 'Pinned' : 'Unpinned'} section`, teacher.id);
    }
  } catch (error) {
    console.error('Error toggling pin:', error);
    alert('Failed to update pin status: ' + error.message);
  }
}

// Function to delete a section
async function deleteSection(sectionId, sectionName) {
  if (!confirm(`Are you sure you want to delete "${sectionName}"?\n\nThis will remove all students from this section and cannot be undone.`)) {
    return;
  }

  try {
    const teacher = checkTeacherAuth();
    if (!teacher) return;

    const response = await fetch('/api/section-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'delete',
        sectionId: sectionId,
        teacherId: teacher.id
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to delete section');
    }

    // If we're viewing this section, close it
    if (currentSection && currentSection.id === sectionId) {
      closeSection();
    }

    // Reload sections
    await loadSections();

    // Log activity
    if (window.auditLog) {
      await window.auditLog.logActivity('section_deleted', `Deleted section: ${sectionName}`, teacher.id);
    }
  } catch (error) {
    console.error('Error deleting section:', error);
    alert('Failed to delete section: ' + error.message);
  }
}

// Function to open a section
async function openSection(sectionId) {
  currentSection = sections.find(s => s.id === sectionId);
  if (!currentSection) return;

  const sectionContent = document.getElementById('sectionContent');
  const sectionContentEmpty = document.getElementById('sectionContentEmpty');
  
  const nameEl = document.getElementById('currentSectionName');
  const codeEl = document.getElementById('currentSectionCode');
  if (nameEl) {
    nameEl.textContent = currentSection.name;
  }
  if (codeEl) {
    codeEl.innerHTML = `Section Code: <code class="text-primary">${currentSection.code}</code>`;
  }
  
  // Hide empty state and show section content
  if (sectionContentEmpty) {
    sectionContentEmpty.classList.add('section-hidden');
    sectionContentEmpty.style.display = 'none';
  }
  if (sectionContent) {
    sectionContent.classList.remove('section-hidden');
    sectionContent.style.display = 'block';
  }
  
  await loadSectionStudents();
}

// Function to close section view
function closeSection() {
  currentSection = null;
  currentStudent = null;
  
  const sectionContent = document.getElementById('sectionContent');
  const sectionContentEmpty = document.getElementById('sectionContentEmpty');
  
  if (sectionContent) {
    sectionContent.classList.add('section-hidden');
    sectionContent.style.display = 'none';
  }
  if (sectionContentEmpty) {
    sectionContentEmpty.classList.remove('section-hidden');
    sectionContentEmpty.style.display = 'flex';
  }
  
  const studentProgressSection = document.getElementById('studentProgressSection');
  if (studentProgressSection) {
    studentProgressSection.style.display = 'none';
  }
}

// Function to load students in current section
async function loadSectionStudents() {
  if (!currentSection) return;

  try {
    const response = await fetch('/api/get-section-students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: currentSection.id })
    });

    if (!response.ok) {
      throw new Error(`Failed to load students: ${response.status}`);
    }

    const result = await response.json();
    sectionStudents = result.students || [];
    
    renderSectionStudents();
  } catch (error) {
    console.error('Error loading section students:', error);
    document.getElementById('sectionStudentsBody').innerHTML = 
      '<tr><td colspan="4" class="text-danger text-center">Error loading students: ' + error.message + '</td></tr>';
  }
}

// Function to render students in section
function renderSectionStudents() {
  const tbody = document.getElementById('sectionStudentsBody');
  tbody.innerHTML = '';

  if (sectionStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No students in this section yet. Invite students to get started!</td></tr>';
    return;
  }

  sectionStudents.forEach(student => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${student.username}</td>
      <td>${student.email}</td>
      <td>${student.joined_at ? new Date(student.joined_at).toLocaleDateString() : 'N/A'}</td>
      <td class="text-end">
        <div class="d-flex gap-2 justify-content-end">
          <button class="btn btn-sm btn-primary" onclick="viewStudentProgress('${student.uuid}')">View Progress</button>
          <button class="btn btn-sm btn-outline-danger" onclick="removeStudentFromSection('${student.uuid}')">Remove</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Function to view student progress
async function viewStudentProgress(studentId) {
  currentStudent = sectionStudents.find(s => s.uuid === studentId);
  if (!currentStudent) return;

  document.getElementById('selectedStudentName').textContent = currentStudent.username;
  document.getElementById('studentProgressSection').style.display = 'block';
  document.getElementById('studentProgressSection').scrollIntoView({ behavior: 'smooth' });

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
      '<tr><td colspan="6" class="text-danger text-center">Error loading stats: ' + error.message + '</td></tr>';
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

// Function to show create section modal
function showCreateSectionModal() {
  document.getElementById('sectionName').value = '';
  const modal = new bootstrap.Modal(document.getElementById('createSectionModal'));
  modal.show();
}

// Function to create a new section
async function createSection() {
  const sectionName = document.getElementById('sectionName').value.trim();
  
  if (!sectionName) {
    alert('Please enter a section name');
    return;
  }

  try {
    const teacher = checkTeacherAuth();
    if (!teacher) return;

    const response = await fetch('/api/create-section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        teacherId: teacher.id,
        name: sectionName
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to create section');
    }

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('createSectionModal'));
    modal.hide();

    // Reload sections
    await loadSections();

    // Log activity
    if (window.auditLog) {
      await window.auditLog.logActivity('section_created', `Created section: ${sectionName}`, teacher.id);
    }
  } catch (error) {
    console.error('Error creating section:', error);
    alert('Failed to create section: ' + error.message);
  }
}

// Function to show invite student modal
function showInviteStudentModal() {
  if (!currentSection) {
    alert('Please select a section first');
    return;
  }
  document.getElementById('studentIdentifier').value = '';
  const modal = new bootstrap.Modal(document.getElementById('inviteStudentModal'));
  modal.show();
}

// Function to invite student to section
async function inviteStudent() {
  const identifier = document.getElementById('studentIdentifier').value.trim();
  
  if (!identifier) {
    alert('Please enter a username or email');
    return;
  }

  if (!currentSection) {
    alert('No section selected');
    return;
  }

  try {
    const teacher = checkTeacherAuth();
    if (!teacher) return;

    const response = await fetch('/api/student-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'invite',
        sectionId: currentSection.id,
        identifier: identifier
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to invite student');
    }

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('inviteStudentModal'));
    modal.hide();

    // Reload section students
    await loadSectionStudents();
    await loadSections(); // Refresh section count

    // Log activity
    if (window.auditLog) {
      await window.auditLog.logActivity('student_invited', `Invited ${identifier} to section ${currentSection.name}`, teacher.id);
    }
  } catch (error) {
    console.error('Error inviting student:', error);
    alert('Failed to invite student: ' + error.message);
  }
}

// Function to remove student from section
async function removeStudentFromSection(studentId) {
  if (!currentSection) return;

  if (!confirm('Are you sure you want to remove this student from the section?')) {
    return;
  }

  try {
    const teacher = checkTeacherAuth();
    if (!teacher) return;

    const response = await fetch('/api/student-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'remove',
        sectionId: currentSection.id,
        studentId: studentId
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to remove student');
    }

    // Reload section students
    await loadSectionStudents();
    await loadSections(); // Refresh section count

    // Log activity
    if (window.auditLog) {
      const student = sectionStudents.find(s => s.uuid === studentId);
      await window.auditLog.logActivity('student_removed', `Removed ${student?.username || studentId} from section ${currentSection.name}`, teacher.id);
    }
  } catch (error) {
    console.error('Error removing student:', error);
    alert('Failed to remove student: ' + error.message);
  }
}

// Make functions globally available
window.openSection = openSection;
window.closeSection = closeSection;
window.viewStudentProgress = viewStudentProgress;
window.showCreateSectionModal = showCreateSectionModal;
window.createSection = createSection;
window.showInviteStudentModal = showInviteStudentModal;
window.inviteStudent = inviteStudent;
window.removeStudentFromSection = removeStudentFromSection;
window.filterSections = filterSections;
window.sortSections = sortSections;
window.deleteSection = deleteSection;
window.togglePinSection = togglePinSection;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  const teacher = checkTeacherAuth();
  if (!teacher) return;

  displayTeacherName();
  
  // Ensure empty state is visible and section content is hidden on load
  const sectionContent = document.getElementById('sectionContent');
  const sectionContentEmpty = document.getElementById('sectionContentEmpty');
  if (sectionContent) {
    sectionContent.classList.add('section-hidden');
    sectionContent.style.display = 'none';
  }
  if (sectionContentEmpty) {
    sectionContentEmpty.classList.remove('section-hidden');
    sectionContentEmpty.style.display = 'flex';
  }
  
  loadSections();

  // Log dashboard access
  if (window.auditLog) {
    window.auditLog.logActivity('dashboard_access', 'Teacher accessed dashboard', teacher.id);
  }
});

