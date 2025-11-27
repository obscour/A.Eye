let sections = [];
let filteredSections = [];
let currentSection = null;
let sectionStudents = [];
let sortedSectionStudents = []; // Store sorted students list
let currentStudent = null;
let currentSort = { column: null, asc: true };
let studentSortOrder = 'name-asc'; // Default sort order for students
let performanceChart = null;
let letterVisibility = {}; // Track which letters are visible
let studentStatsData = []; // Store stats data for sorting
let performanceHistory = []; // Store performance history data

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
    // Format name as lastname, firstname (username) - no comma before parentheses
    let formattedName = '';
    if (teacher.last_name && teacher.first_name) {
      formattedName = `${teacher.last_name}, ${teacher.first_name} (${teacher.username || teacher.email})`;
    } else if (teacher.first_name) {
      formattedName = `${teacher.first_name} (${teacher.username || teacher.email})`;
    } else if (teacher.last_name) {
      formattedName = `${teacher.last_name} (${teacher.username || teacher.email})`;
    } else {
      formattedName = teacher.username || teacher.email || 'Unknown';
    }
    
    const welcomeText = `Welcome! <strong>${formattedName}</strong>`;
    const teacherNameEl = document.getElementById('teacherName');
    if (teacherNameEl) {
      teacherNameEl.innerHTML = welcomeText;
      // Make text white like MIS dashboard
      teacherNameEl.style.color = 'white';
    }
  }
}

// Function to load all sections for the teacher
async function loadSections() {
  try {
    const teacher = checkTeacherAuth();
    if (!teacher) return;

    const response = await authenticatedFetch('/api/sections', {
      method: 'POST',
      body: JSON.stringify({ action: 'get-sections', teacherId: teacher.id })
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
          <button class="btn btn-sm btn-outline-secondary" type="button" id="sectionMenu${section.id}" data-bs-toggle="dropdown" aria-expanded="false" style="border: none; padding: 0.25rem 0.5rem;" data-section-id="${section.id}">
            <span style="font-size: 1.2rem;">☰</span>
          </button>
          <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="sectionMenu${section.id}">
            <li>
              <a class="dropdown-item pin-section-item" href="#" data-section-id="${section.id}" data-pin-status="${!isPinned}">
                ${isPinned ? 'Unpin Section' : 'Pin Section'}
              </a>
            </li>
            <li><hr class="dropdown-divider"></li>
            <li>
              <a class="dropdown-item text-danger delete-section-item" href="#" data-section-id="${section.id}" data-section-name="${section.name.replace(/'/g, "&#39;")}">
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

    const response = await authenticatedFetch('/api/section-actions', {
      method: 'POST',
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

    const response = await authenticatedFetch('/api/section-actions', {
      method: 'POST',
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
      await window.auditLog.logActivity('SECTION_DELETED', `Deleted section: ${sectionName}`, teacher.id);
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
    codeEl.innerHTML = `Code: <code class="text-primary">${currentSection.code}</code>`;
  }
  
  // Hide student progress when opening a new section
  const studentProgressSection = document.getElementById('studentProgressSection');
  const studentProgressEmpty = document.getElementById('studentProgressEmpty');
  if (studentProgressSection) {
    studentProgressSection.style.display = 'none';
  }
  if (studentProgressEmpty) {
    studentProgressEmpty.style.display = 'block';
  }
  
  // Hide empty state and show section content
  if (sectionContentEmpty) {
    sectionContentEmpty.classList.add('section-hidden');
    sectionContentEmpty.setAttribute('style', 'display: none !important; visibility: hidden !important;');
  }
  if (sectionContent) {
    sectionContent.classList.remove('section-hidden');
    sectionContent.setAttribute('style', 'display: block !important; visibility: visible !important; width: 626px; height: 426px; position: absolute; top: 0; left: 0; z-index: 2;');
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
    sectionContent.setAttribute('style', 'display: none !important; visibility: hidden !important;');
  }
  if (sectionContentEmpty) {
    sectionContentEmpty.classList.remove('section-hidden');
    sectionContentEmpty.setAttribute('style', 'display: flex !important; visibility: visible !important; position: absolute; top: 0; left: 0; width: 626px; height: 426px; z-index: 1;');
  }
  
  const studentProgressSection = document.getElementById('studentProgressSection');
  const studentProgressEmpty = document.getElementById('studentProgressEmpty');
  if (studentProgressSection) {
    studentProgressSection.setAttribute('style', 'display: none !important;');
  }
  if (studentProgressEmpty) {
    studentProgressEmpty.setAttribute('style', 'display: flex !important; min-height: 300px;');
  }
}

// Function to load students in current section
async function loadSectionStudents() {
  if (!currentSection) {
    console.error('No current section set');
    return;
  }

  console.log('Loading students for section:', currentSection.id, currentSection.name);

  try {
    const response = await authenticatedFetch('/api/sections', {
      method: 'POST',
      body: JSON.stringify({ action: 'get-students', sectionId: currentSection.id })
    });

    if (!response.ok) {
      throw new Error(`Failed to load students: ${response.status}`);
    }

    const result = await response.json();
    console.log('Students API response:', result);
    sectionStudents = result.students || [];
    
    console.log('Loaded students:', sectionStudents.length, sectionStudents);
    
    // Reset sorted list and apply current sort
    sortedSectionStudents = [];
    sortStudents(); // This will sort and render
  } catch (error) {
    console.error('Error loading section students:', error);
    const tbody = document.getElementById('sectionStudentsBody');
    if (tbody) {
      tbody.innerHTML = 
        '<tr><td colspan="2" class="text-danger text-center">Error loading students: ' + error.message + '</td></tr>';
    }
  }
}

// Helper function to format student name as last_name, first_name (email)
function formatStudentName(student) {
  if (student.last_name && student.first_name) {
    return `${student.last_name}, ${student.first_name} (${student.email})`;
  } else if (student.first_name) {
    return `${student.first_name} (${student.email})`;
  } else if (student.last_name) {
    return `${student.last_name} (${student.email})`;
  } else {
    return student.email || student.username || 'Unknown';
  }
}

// Function to sort students
function sortStudents() {
  const sortValue = document.getElementById('studentSort').value;
  studentSortOrder = sortValue;
  
  if (sectionStudents.length === 0) {
    sortedSectionStudents = [];
    renderSectionStudents();
    return;
  }
  
  sortedSectionStudents = [...sectionStudents].sort((a, b) => {
    // Get formatted names for comparison
    const nameA = formatStudentName(a).toLowerCase();
    const nameB = formatStudentName(b).toLowerCase();
    
    if (sortValue === 'name-asc') {
      return nameA.localeCompare(nameB);
    } else if (sortValue === 'name-desc') {
      return nameB.localeCompare(nameA);
    }
    return 0;
  });
  
  renderSectionStudents();
}

// Function to render students in section
function renderSectionStudents() {
  const tbody = document.getElementById('sectionStudentsBody');
  if (!tbody) {
    console.error('sectionStudentsBody element not found!');
    return;
  }
  
  tbody.innerHTML = '';

  // Use sorted list if available, otherwise use original list
  const studentsToRender = sortedSectionStudents.length > 0 ? sortedSectionStudents : sectionStudents;

  console.log('Rendering students:', studentsToRender.length, studentsToRender);

  if (studentsToRender.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted small">No students in this section yet. Invite students to get started!</td></tr>';
    return;
  }

  studentsToRender.forEach(student => {
    const row = document.createElement('tr');
    const studentName = formatStudentName(student);
    row.innerHTML = `
      <td class="small">${studentName}</td>
      <td class="text-end">
        <div class="d-flex gap-1 justify-content-end">
          <button class="btn btn-sm btn-primary" onclick="viewStudentProgress('${student.uuid}')" style="font-size: 0.75rem; padding: 0.2rem 0.4rem;">View</button>
          <button class="btn btn-sm btn-outline-danger" onclick="removeStudentFromSection('${student.uuid}')" style="font-size: 0.75rem; padding: 0.2rem 0.4rem;">Remove</button>
        </div>
      </td>
    `;
    // Ensure row is visible
    row.style.display = 'table-row';
    row.style.visibility = 'visible';
    tbody.appendChild(row);
  });
  
  // Ensure table is visible
  const table = document.getElementById('sectionStudentsTable');
  const tableContainer = tbody.closest('.table-responsive');
  if (table) {
    table.style.display = 'table';
    table.style.visibility = 'visible';
    table.style.height = 'auto';
    table.style.minHeight = '50px';
  }
  if (tableContainer) {
    tableContainer.style.display = 'block';
    tableContainer.style.visibility = 'visible';
    tableContainer.style.minHeight = '150px';
    tableContainer.style.height = 'auto';
    // Force a reflow to ensure visibility
    void tableContainer.offsetHeight;
  }
  
  // Log for debugging - check if rows are actually in DOM
  console.log('Table container:', tableContainer);
  console.log('Table:', table);
  console.log('Tbody children:', tbody.children.length);
  if (tbody.children.length > 0) {
    console.log('First row:', tbody.children[0]);
    const firstRowStyle = window.getComputedStyle(tbody.children[0]);
    console.log('First row computed style:', firstRowStyle);
    console.log('First row display:', firstRowStyle.display);
    console.log('First row visibility:', firstRowStyle.visibility);
    console.log('First row height:', firstRowStyle.height);
  }
  if (tableContainer) {
    const containerStyle = window.getComputedStyle(tableContainer);
    console.log('Container height:', containerStyle.height);
    console.log('Container max-height:', containerStyle.maxHeight);
    console.log('Container overflow-y:', containerStyle.overflowY);
    console.log('Container display:', containerStyle.display);
  }
  if (table) {
    const tableStyle = window.getComputedStyle(table);
    console.log('Table height:', tableStyle.height);
    console.log('Table display:', tableStyle.display);
  }
}

// Function to view student progress
async function viewStudentProgress(studentId) {
  currentStudent = sectionStudents.find(s => s.uuid === studentId);
  if (!currentStudent) {
    console.error('Student not found in section:', studentId);
    return;
  }

  // Verify student is in current section before proceeding
  if (!currentSection) {
    console.error('No section selected');
    return;
  }

  const studentProgressSection = document.getElementById('studentProgressSection');
  const studentProgressEmpty = document.getElementById('studentProgressEmpty');
  
  // Hide empty state and show progress section FIRST - use !important via inline style
  if (studentProgressEmpty) {
    studentProgressEmpty.setAttribute('style', 'display: none !important; min-height: 300px;');
  }
  if (studentProgressSection) {
    studentProgressSection.setAttribute('style', 'display: block !important;');
  }
  
  // Update student name after showing the section
  const selectedStudentNameEl = document.getElementById('selectedStudentName');
  if (selectedStudentNameEl) {
    selectedStudentNameEl.textContent = formatStudentName(currentStudent);
  }
  
  // Log audit activity - only if student is in teacher's section
  if (window.auditLog && currentSection && isStudentInTeacherSection(studentId)) {
    const teacher = checkTeacherAuth();
    if (teacher) {
      await window.auditLog.logActivity(
        'VIEWED_STUDENT_PROGRESS',
        `Viewed progress for student: ${formatStudentName(currentStudent)} in section "${currentSection.name}" (Code: ${currentSection.code})`,
        teacher.id
      );
    }
  }

  // Reset sort state when viewing a new student
  currentSort = { column: null, asc: true };

  // Reset letter visibility when viewing a new student
  for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    letterVisibility[char] = false;
  }
  
  // Clear any existing chart data
  if (performanceChart) {
    performanceChart.data.labels = [];
    performanceChart.data.datasets = [];
    performanceChart.update();
  }

  try {
    const response = await authenticatedFetch('/api/user-data', {
      method: 'POST',
      body: JSON.stringify({ action: 'get-stats', userId: studentId })
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
        attempts: Math.round((data.attempts || 0) * 100) / 100, // Round to 2 decimals for display
        mastery_score: Math.round((data.mastery || 0) * 100) / 100,
        correct_count: Math.round((data.correct || 0) * 100) / 100,
        avg_response_time: 0,
        streak: Math.round((data.streak || 0) * 100) / 100
      }));
    }

    studentStatsData = statsArray;
    renderStudentStatsTable(studentStatsData);
    updateSortIndicators();
    
    // Initialize chart if not already done (after DOM is updated)
    if (!performanceChart) {
      // Wait a bit for the section to be fully visible
      setTimeout(() => {
        initializePerformanceChart();
        // After chart is initialized, load history
        loadPerformanceHistory(studentId).then(() => {
          updatePerformanceChart();
        });
      }, 200);
    } else {
      // Chart already exists, just load history and update
      await loadPerformanceHistory(studentId);
      updatePerformanceChart();
    }
  } catch (error) {
    console.error('Error loading student stats:', error);
    document.getElementById('studentStatsBody').innerHTML = 
      '<tr><td colspan="6" class="text-danger text-center">Error loading stats: ' + error.message + '</td></tr>';
  }
}

// Initialize performance chart (blank on load)
function initializePerformanceChart() {
  const ctx = document.getElementById('performanceChart');
  if (!ctx) {
    console.warn('Performance chart canvas not found');
    return;
  }

  // Initialize all letters as hidden
  for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    letterVisibility[char] = false;
  }

  performanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      aspectRatio: 2.5,
      layout: {
        padding: {
          top: 10,
          bottom: 10,
          left: 10,
          right: 10
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Mastery Score (%)',
            font: {
              size: 14,
              weight: 'bold'
            },
            padding: { top: 10, bottom: 10 }
          },
          ticks: {
            font: {
              size: 12
            },
            stepSize: 10
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
            lineWidth: 1
          }
        },
        x: {
          title: {
            display: true,
            text: 'Date',
            font: {
              size: 14,
              weight: 'bold'
            },
            padding: { top: 10, bottom: 10 }
          },
          ticks: {
            font: {
              size: 11
            },
            maxRotation: 45,
            minRotation: 45
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
            lineWidth: 1
          }
        }
      },
      plugins: {
        legend: {
          display: false // Disable built-in legend, we'll use custom one
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 10,
          titleFont: {
            size: 13,
            weight: 'bold'
          },
          bodyFont: {
            size: 12
          },
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          displayColors: true,
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + '%';
            }
          }
        }
      }
    }
  });

  // Initialize custom legend (shows all letters)
  updateCustomLegend();
}

// Load performance history data for current student
async function loadPerformanceHistory(studentId) {
  try {
    if (!studentId) return;
    
    const response = await authenticatedFetch('/api/user-data', {
      method: 'POST',
      body: JSON.stringify({ action: 'get-history', userId: studentId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load history: ${response.status}`);
    }
    
    const result = await response.json();
    performanceHistory = result.history || [];
    
    // Update chart with current selections
    updatePerformanceChart();
  } catch (error) {
    console.error('Error loading performance history:', error);
    performanceHistory = [];
  }
}

// Toggle letter visibility (called from legend click)
function toggleLetter(letter) {
  letterVisibility[letter] = !letterVisibility[letter];
  updatePerformanceChart();
  updateCustomLegend(); // Update legend to reflect new state
}

// Select all letters
function selectAllLetters() {
  for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    letterVisibility[char] = true;
  }
  updatePerformanceChart();
  updateCustomLegend(); // Update legend to reflect selection
}

// Unselect all letters
function unselectAllLetters() {
  for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    letterVisibility[char] = false;
  }
  updatePerformanceChart();
  updateCustomLegend(); // Update legend to reflect selection
}

// Update performance chart with historical data
function updatePerformanceChart(stats) {
  if (!performanceChart) return;

  // Get visible letters
  const visibleLetters = [];
  for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (letterVisibility[char]) {
      visibleLetters.push(char);
    }
  }
  
  if (visibleLetters.length === 0 || performanceHistory.length === 0) {
    // No letters visible or no history, show empty chart
    performanceChart.data.labels = [];
    performanceChart.data.datasets = [];
    performanceChart.update();
    return;
  }

  // Sort history by date (oldest first)
  const sortedHistory = [...performanceHistory].sort((a, b) => 
    new Date(a.recorded_at) - new Date(b.recorded_at)
  );

  // Get all unique dates
  const dates = sortedHistory.map(h => h.recorded_at);
  const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(a) - new Date(b));

  // Generate more distinct colors for better visibility
  const colors = [
    'rgb(255, 99, 132)',   // Red
    'rgb(54, 162, 235)',   // Blue
    'rgb(75, 192, 192)',   // Teal
    'rgb(255, 206, 86)',   // Yellow
    'rgb(153, 102, 255)',  // Purple
    'rgb(255, 159, 64)',   // Orange
    'rgb(201, 203, 207)',  // Gray
    'rgb(255, 99, 255)',   // Magenta
    'rgb(99, 255, 132)',   // Green
    'rgb(99, 132, 255)',   // Light Blue
    'rgb(255, 0, 0)',      // Bright Red
    'rgb(0, 128, 255)',    // Bright Blue
    'rgb(0, 200, 0)',       // Bright Green
    'rgb(255, 128, 0)',     // Bright Orange
    'rgb(128, 0, 255)',     // Bright Purple
    'rgb(255, 0, 128)',     // Pink
    'rgb(0, 255, 255)',     // Cyan
    'rgb(255, 255, 0)',     // Bright Yellow
    'rgb(128, 128, 128)',   // Medium Gray
    'rgb(0, 0, 255)',       // Pure Blue
    'rgb(255, 128, 128)',   // Light Red
    'rgb(128, 255, 128)',   // Light Green
    'rgb(128, 128, 255)',   // Light Purple
    'rgb(255, 192, 128)',   // Peach
    'rgb(192, 255, 192)',   // Light Mint
    'rgb(192, 192, 255)'    // Lavender
  ];

  // Format dates for display in GMT+8 (frontend only - data stored in UTC)
  const formattedDates = uniqueDates.map(date => {
    const d = new Date(date);
    // Convert to GMT+8 for display only
    return d.toLocaleDateString('en-US', { 
      timeZone: 'Asia/Manila',
      month: 'short', 
      day: 'numeric' 
    });
  });

  // Warn if too many letters selected (hard to read)
  if (visibleLetters.length > 10) {
    console.warn(`Warning: ${visibleLetters.length} letters selected. Consider selecting fewer letters for better readability.`);
  }

  // Create datasets for each visible letter
  const datasets = visibleLetters.map((letter, index) => {
    const color = colors[index % colors.length];
    const data = uniqueDates.map(date => {
      // Find the history record for this date
      const historyRecord = sortedHistory.find(h => h.recorded_at === date);
      if (!historyRecord || !historyRecord.stats) return 0;
      
      const letterStats = historyRecord.stats[letter];
      if (!letterStats) return 0;
      
      // Ensure mastery is in 0-100 range (convert from 0-1 if needed)
      let mastery = letterStats.mastery || 0;
      if (mastery > 0 && mastery <= 1) {
        mastery = mastery * 100; // Convert from decimal to percentage
      }
      return mastery;
    });

    return {
      label: `Letter ${letter}`,
      data: data,
      borderColor: color,
      backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
      borderWidth: 2.5,
      tension: 0.4,
      fill: false,
      pointRadius: 5,
      pointHoverRadius: 8,
      pointBorderWidth: 2,
      pointBackgroundColor: color,
      pointBorderColor: '#fff'
    };
  });

  // Update chart
  performanceChart.data.labels = formattedDates;
  performanceChart.data.datasets = datasets;
  performanceChart.update();
  
  // Update custom legend
  updateCustomLegend();
}

// Function to update custom legend outside chart container - always shows all letters
function updateCustomLegend() {
  const legendContainer = document.getElementById('chartLegend');
  if (!legendContainer) {
    return;
  }
  
  // Preserve the buttons container (Select All/Select None) - don't clear entire container
  const buttonsContainer = legendContainer.querySelector('.d-flex.justify-content-center.gap-2');
  if (!buttonsContainer) {
    // If buttons don't exist, create them
    const btnContainer = document.createElement('div');
    btnContainer.className = 'd-flex justify-content-center gap-2 mb-2';
    btnContainer.innerHTML = `
      <button type="button" class="btn btn-sm btn-outline-primary" onclick="selectAllLetters()">Select All</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" onclick="unselectAllLetters()">Select None</button>
    `;
    legendContainer.insertBefore(btnContainer, legendContainer.firstChild);
  }
  
  // Generate colors for all letters (same as in updatePerformanceChart)
  const colors = [
    'rgb(255, 99, 132)',   // Red
    'rgb(54, 162, 235)',   // Blue
    'rgb(75, 192, 192)',   // Teal
    'rgb(255, 206, 86)',   // Yellow
    'rgb(153, 102, 255)',  // Purple
    'rgb(255, 159, 64)',   // Orange
    'rgb(201, 203, 207)',  // Gray
    'rgb(255, 99, 255)',   // Magenta
    'rgb(99, 255, 132)',   // Green
    'rgb(99, 132, 255)',   // Light Blue
    'rgb(255, 0, 0)',      // Bright Red
    'rgb(0, 128, 255)',    // Bright Blue
    'rgb(0, 200, 0)',       // Bright Green
    'rgb(255, 128, 0)',     // Bright Orange
    'rgb(128, 0, 255)',     // Bright Purple
    'rgb(255, 0, 128)',     // Pink
    'rgb(0, 255, 255)',     // Cyan
    'rgb(255, 255, 0)',     // Bright Yellow
    'rgb(128, 128, 128)',   // Medium Gray
    'rgb(0, 0, 255)',       // Pure Blue
    'rgb(255, 128, 128)',   // Light Red
    'rgb(128, 255, 128)',   // Light Green
    'rgb(128, 128, 255)',   // Light Purple
    'rgb(255, 192, 128)',   // Peach
    'rgb(192, 255, 192)',   // Light Mint
    'rgb(192, 192, 255)'    // Lavender
  ];
  
  // Clear existing legend items (but keep buttons)
  const existingLegend = legendContainer.querySelector('.legend-list');
  if (existingLegend) {
    existingLegend.remove();
  }
  
  const legendList = document.createElement('div');
  legendList.className = 'legend-list d-flex flex-wrap justify-content-center gap-2';
  legendList.style.fontSize = '0.75rem';
  
  // Create legend items for all 26 letters
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i); // A-Z
    const color = colors[i % colors.length];
    const isVisible = letterVisibility[letter] || false;
    
    // Check if this letter is hidden in the chart
    let isHidden = false;
    if (performanceChart) {
      const datasetIndex = performanceChart.data.datasets.findIndex(d => d.label === `Letter ${letter}`);
      if (datasetIndex >= 0) {
        const meta = performanceChart.getDatasetMeta(datasetIndex);
        isHidden = meta ? meta.hidden : false;
      }
    }
    
    const legendItem = document.createElement('span');
    legendItem.className = 'legend-item d-inline-flex align-items-center me-2';
    legendItem.style.cursor = 'pointer';
    legendItem.style.marginBottom = '0.25rem';
    legendItem.style.userSelect = 'none';
    
    const colorBox = document.createElement('span');
    colorBox.style.width = '12px';
    colorBox.style.height = '12px';
    colorBox.style.borderRadius = '50%';
    colorBox.style.backgroundColor = color;
    colorBox.style.display = 'inline-block';
    colorBox.style.marginRight = '6px';
    colorBox.style.flexShrink = '0';
    colorBox.style.border = '1px solid rgba(0,0,0,0.1)';
    
    const label = document.createElement('span');
    label.textContent = `Letter ${letter}`;
    label.style.color = (!isVisible || isHidden) ? '#999' : '#333';
    label.style.textDecoration = (!isVisible || isHidden) ? 'line-through' : 'none';
    label.style.fontWeight = '500';
    
    legendItem.appendChild(colorBox);
    legendItem.appendChild(label);
    
    // Toggle visibility on click
    legendItem.addEventListener('click', () => {
      // Toggle letter visibility
      letterVisibility[letter] = !letterVisibility[letter];
      
      // Update chart
      if (performanceChart) {
        updatePerformanceChart();
      }
      
      // Update legend to reflect new state
      updateCustomLegend();
    });
    
    legendList.appendChild(legendItem);
  }
  
  // Insert legend list after buttons
  if (buttonsContainer && buttonsContainer.nextSibling) {
    legendContainer.insertBefore(legendList, buttonsContainer.nextSibling);
  } else {
    legendContainer.appendChild(legendList);
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

// Function to sort and render student stats
function sortStudentStats(column) {
  if (currentSort.column === column) {
    currentSort.asc = !currentSort.asc;
  } else {
    currentSort.column = column;
    currentSort.asc = true;
  }
  
  studentStatsData.sort((a, b) => {
    if (a[column] == null) return 1;
    if (b[column] == null) return -1;
    if (typeof a[column] === 'number' && typeof b[column] === 'number') {
      return currentSort.asc ? a[column] - b[column] : b[column] - a[column];
    }
    return currentSort.asc
      ? String(a[column]).localeCompare(String(b[column]))
      : String(b[column]).localeCompare(String(a[column]));
  });
  
  renderStudentStatsTable(studentStatsData);
  updateSortIndicators();
}

// Update sort indicators for student stats table
function updateSortIndicators() {
  document.querySelectorAll('#studentStatsTable th.sortable').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.column === currentSort.column) {
      th.classList.add(currentSort.asc ? 'sorted-asc' : 'sorted-desc');
    }
  });
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

    const response = await authenticatedFetch('/api/section-actions', {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'create',
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
      await window.auditLog.logActivity('SECTION_CREATED', `Created section: ${sectionName}`, teacher.id);
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

// Helper function to verify student is in teacher's section before logging
function isStudentInTeacherSection(studentId) {
  if (!currentSection) return false;
  return sectionStudents.some(s => s.uuid === studentId);
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

    const response = await authenticatedFetch('/api/student-actions', {
      method: 'POST',
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

    // Log activity - only if student was successfully added to section
    if (window.auditLog && currentSection) {
      // Get the student info from the response or reloaded list
      const addedStudent = sectionStudents.find(s => 
        s.email === identifier || s.username === identifier
      );
      if (addedStudent) {
        await window.auditLog.logActivity(
          'STUDENT_ADDED',
          `Added student: ${formatStudentName(addedStudent)} to section "${currentSection.name}" (Code: ${currentSection.code})`,
          teacher.id
        );
      } else {
        // Fallback if student info not immediately available
        await window.auditLog.logActivity(
          'STUDENT_ADDED',
          `Added student: ${identifier} to section "${currentSection.name}" (Code: ${currentSection.code})`,
          teacher.id
        );
      }
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

    const response = await authenticatedFetch('/api/student-actions', {
      method: 'POST',
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

    // Get student info before removing (for audit log)
    const removedStudent = sectionStudents.find(s => s.uuid === studentId);
    const studentName = removedStudent ? formatStudentName(removedStudent) : 'Unknown Student';

    // Reload section students
    await loadSectionStudents();
    await loadSections(); // Refresh section count

    // Log activity - only if student was in the section
    if (window.auditLog && currentSection && removedStudent) {
      await window.auditLog.logActivity(
        'STUDENT_REMOVED',
        `Removed student: ${studentName} from section "${currentSection.name}" (Code: ${currentSection.code})`,
        teacher.id
      );
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
window.sortStudents = sortStudents;
window.deleteSection = deleteSection;
window.togglePinSection = togglePinSection;
window.selectAllLetters = selectAllLetters;
window.unselectAllLetters = unselectAllLetters;

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
    sectionContent.setAttribute('style', 'display: none !important; visibility: hidden !important;');
  }
  if (sectionContentEmpty) {
    sectionContentEmpty.classList.remove('section-hidden');
    sectionContentEmpty.setAttribute('style', 'display: flex !important; visibility: visible !important; position: absolute; top: 0; left: 0; width: 626px; height: 426px; z-index: 1;');
  }
  
  // Hide student progress on page load
  const studentProgressSection = document.getElementById('studentProgressSection');
  const studentProgressEmpty = document.getElementById('studentProgressEmpty');
  if (studentProgressSection) {
    studentProgressSection.setAttribute('style', 'display: none !important;');
  }
  if (studentProgressEmpty) {
    studentProgressEmpty.setAttribute('style', 'display: flex !important; min-height: 300px;');
  }
  
  // Initialize student sort dropdown
  const studentSortSelect = document.getElementById('studentSort');
  if (studentSortSelect) {
    studentSortSelect.value = studentSortOrder;
  }
  
  loadSections();

  // Attach sorting event listeners for student stats table
  // Use event delegation since table is dynamically shown/hidden
  document.addEventListener('click', function(e) {
    const sortableHeader = e.target.closest('#studentStatsTable th.sortable');
    if (sortableHeader) {
      e.preventDefault();
      sortStudentStats(sortableHeader.dataset.column);
    }
  });

  // Event delegation for section dropdown menu items
  document.addEventListener('click', function(e) {
    // Handle pin/unpin section
    const pinItem = e.target.closest('.pin-section-item');
    if (pinItem) {
      e.preventDefault();
      e.stopPropagation();
      const sectionId = pinItem.dataset.sectionId;
      const pinStatus = pinItem.dataset.pinStatus === 'true';
      togglePinSection(sectionId, pinStatus);
      return false;
    }

    // Handle delete section
    const deleteItem = e.target.closest('.delete-section-item');
    if (deleteItem) {
      e.preventDefault();
      e.stopPropagation();
      const sectionId = deleteItem.dataset.sectionId;
      const sectionName = deleteItem.dataset.sectionName;
      deleteSection(sectionId, sectionName);
      return false;
    }
  });

});

