// Helper function to format user name as last_name, first_name (username)
function formatUserName(user) {
  if (user.last_name && user.first_name) {
    return `${user.last_name}, ${user.first_name} (${user.username || user.email})`;
  } else if (user.first_name) {
    return `${user.first_name} (${user.username || user.email})`;
  } else if (user.last_name) {
    return `${user.last_name} (${user.username || user.email})`;
  } else {
    return user.username || user.email || 'Unknown';
  }
}

// Function to generate QR code (larger)
async function generateQRCode({ onlyMobile = false } = {}) {
  try {
    // Get user from localStorage (custom auth)
    const userStr = localStorage.getItem('user');
    if (!userStr) throw new Error('No user logged in');
    
    const user = JSON.parse(userStr);

    // Encode user id, email, and username in the QR code
    const qrPayload = {
      id: user.id,
      email: user.email,
      username: user.username
    };

    const qrData = JSON.stringify(qrPayload);
    if (!onlyMobile) {
      // Desktop sidebar
      const qrcodeDiv = document.getElementById('qrcode');
      if (qrcodeDiv) {
        qrcodeDiv.innerHTML = '';
        new QRCode(qrcodeDiv, {
          text: qrData,
          width: 260,
          height: 260,
          title: '', // Remove hover tooltip
          correctLevel: QRCode.CorrectLevel.M
        });
        
        // Aggressively remove tooltip after QR code is generated
        setTimeout(() => {
          const qrImg = qrcodeDiv.querySelector('img');
          const qrCanvas = qrcodeDiv.querySelector('canvas');
          const qrElement = qrImg || qrCanvas;
          
          if (qrElement) {
            qrElement.removeAttribute('title');
            qrElement.removeAttribute('data-original-title');
            qrElement.style.pointerEvents = 'none';
            qrElement.style.cursor = 'default';
            
            // Remove any event listeners that might show tooltips
            qrElement.onmouseover = null;
            qrElement.onmouseenter = null;
            qrElement.onmouseleave = null;
          }
          
          // Also remove from the container div
          qrcodeDiv.removeAttribute('title');
          qrcodeDiv.style.pointerEvents = 'none';
          
          // Set up a MutationObserver to watch for any changes and remove tooltips
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'attributes' && mutation.attributeName === 'title') {
                mutation.target.removeAttribute('title');
                mutation.target.removeAttribute('data-original-title');
              }
            });
          });
          
          observer.observe(qrcodeDiv, {
            attributes: true,
            attributeFilter: ['title', 'data-original-title']
          });
        }, 100);
      }
    }
    // Mobile offcanvas
    const qrcodeMobileDiv = document.getElementById('qrcodeMobile');
    if (qrcodeMobileDiv) {
      qrcodeMobileDiv.innerHTML = '';
      // Use larger QR code on mobile
      const isMobile = window.innerWidth < 768;
      new QRCode(qrcodeMobileDiv, {
        text: qrData,
        width: isMobile ? 190 : 160,
        height: isMobile ? 190 : 160,
        title: '', // Remove hover tooltip
        correctLevel: QRCode.CorrectLevel.M
      });
      
      // Aggressively remove tooltip after QR code is generated
      setTimeout(() => {
        const qrImgMobile = qrcodeMobileDiv.querySelector('img');
        const qrCanvasMobile = qrcodeMobileDiv.querySelector('canvas');
        const qrElementMobile = qrImgMobile || qrCanvasMobile;
        
        if (qrElementMobile) {
          qrElementMobile.removeAttribute('title');
          qrElementMobile.removeAttribute('data-original-title');
          qrElementMobile.style.pointerEvents = 'none';
          qrElementMobile.style.cursor = 'default';
          
          // Remove any event listeners that might show tooltips
          qrElementMobile.onmouseover = null;
          qrElementMobile.onmouseenter = null;
          qrElementMobile.onmouseleave = null;
        }
        
        // Also remove from the container div
        qrcodeMobileDiv.removeAttribute('title');
        qrcodeMobileDiv.style.pointerEvents = 'none';
        
        // Set up a MutationObserver to watch for any changes and remove tooltips
        const observerMobile = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'title') {
              mutation.target.removeAttribute('title');
              mutation.target.removeAttribute('data-original-title');
            }
          });
        });
        
        observerMobile.observe(qrcodeMobileDiv, {
          attributes: true,
          attributeFilter: ['title', 'data-original-title']
        });
      }, 100);
    }
  } catch (error) {
    const qrcodeDiv = document.getElementById('qrcode');
    if (qrcodeDiv) {
      qrcodeDiv.innerHTML = `<div class='text-danger'>QR code error: ${error?.message || error}</div>`;
    }
    const qrcodeMobileDiv = document.getElementById('qrcodeMobile');
    if (qrcodeMobileDiv) {
      qrcodeMobileDiv.innerHTML = `<div class='text-danger'>QR code error: ${error?.message || error}</div>`;
    }
    console.error('Error generating QR code:', error?.message || error);
  }
}

// Function to display current user
async function displayCurrentUser() {
  try {
    // Get user from localStorage (custom auth)
    const userStr = localStorage.getItem('user');
    if (!userStr) throw new Error('No user logged in');
    
    const user = JSON.parse(userStr);
    // Format name as lastname, firstname (username) - no comma before parentheses
    let formattedName = '';
    if (user.last_name && user.first_name) {
      formattedName = `${user.last_name}, ${user.first_name} (${user.username || user.email})`;
    } else if (user.first_name) {
      formattedName = `${user.first_name} (${user.username || user.email})`;
    } else if (user.last_name) {
      formattedName = `${user.last_name} (${user.username || user.email})`;
    } else {
      formattedName = user.username || user.email || 'Unknown';
    }
    
    const welcomeText = `Welcome! <strong>${formattedName}</strong>`;

    // Desktop sidebar
    const currentUserDiv = document.getElementById('currentUser');
    if (currentUserDiv) currentUserDiv.innerHTML = welcomeText;
    // Mobile offcanvas
    const currentUserMobileDiv = document.getElementById('currentUserMobile');
    if (currentUserMobileDiv) currentUserMobileDiv.innerHTML = welcomeText;
  } catch (error) {
    console.error('Error getting user:', error?.message || error);
    const currentUserDiv = document.getElementById('currentUser');
    if (currentUserDiv) currentUserDiv.textContent = 'Welcome, Guest';
    const currentUserMobileDiv = document.getElementById('currentUserMobile');
    if (currentUserMobileDiv) currentUserMobileDiv.textContent = 'Welcome, Guest';
  }
}

// Function to handle logout
async function logout() {
  try {
    // Get user info before clearing
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    
    // Log logout activity
    if (user && window.auditLog) {
      await window.auditLog.logActivity('logout', `Student ${user.username} logged out`, user.id);
    }
    
    // Clear user from localStorage (custom auth)
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  } catch (error) {
    alert('Logout failed: ' + (error.message || error));
    console.error('Error signing out:', error.message || error);
  }
}
window.logout = logout;

// Function to log quiz activity (can be called from external quiz systems)
async function logQuizActivity(letter, result, responseTime) {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr && window.auditLog) {
      const user = JSON.parse(userStr);
      const details = `Quiz for letter ${letter}: ${result ? 'Correct' : 'Incorrect'} (${responseTime}ms)`;
      await window.auditLog.logActivity('quiz', details, user.id);
    }
  } catch (error) {
    console.error('Error logging quiz activity:', error);
  }
}
window.logQuizActivity = logQuizActivity;

let statsData = [];
let currentSort = { column: null, asc: true };
let performanceChart = null;
let letterVisibility = {}; // Track which letters are visible

// Function to render stats table
function renderStatsTable(stats) {
  const tbody = document.getElementById('userStatsBody');
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
  // Do NOT re-attach sorting event listeners here
}

// Function to sort and render
function sortAndRender(column) {
  if (currentSort.column === column) {
    currentSort.asc = !currentSort.asc;
  } else {
    currentSort.column = column;
    currentSort.asc = true;
  }
  statsData.sort((a, b) => {
    if (a[column] == null) return 1;
    if (b[column] == null) return -1;
    if (typeof a[column] === 'number' && typeof b[column] === 'number') {
      return currentSort.asc ? a[column] - b[column] : b[column] - a[column];
    }
    return currentSort.asc
      ? String(a[column]).localeCompare(String(b[column]))
      : String(b[column]).localeCompare(String(a[column]));
  });
  renderStatsTable(statsData);
  updateSortIndicators();
}

// Update sort indicators
function updateSortIndicators() {
  document.querySelectorAll('#userStatsTable th.sortable').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.column === currentSort.column) {
      th.classList.add(currentSort.asc ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

// Fetch and display user stats through Vercel API
async function displayUserStats() {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) throw new Error('No user logged in');

    const user = JSON.parse(userStr);

    // Call Vercel backend instead of Supabase directly
    const response = await fetch('/api/get-user-stats', {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id })
    });

    if (!response.ok) {
      throw new Error(`Failed to load stats: ${response.status}`);
    }

    const result = await response.json();
    const userData = result.data;

    let statsArray = [];

    if (userData && userData.stats) {
      const statsJson =
        typeof userData.stats === 'string'
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

    statsData = statsArray;
    renderStatsTable(statsData);
    updateSortIndicators();
    
    // Load performance history and update chart
    await loadPerformanceHistory();
    updatePerformanceChart(statsData);
  } catch (error) {
    const tbody = document.getElementById('userStatsBody');
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Error: ${error.message}</td></tr>`;
    console.error('Error fetching stats:', error);
  }
}

// Initialize performance chart (blank on load)
let performanceHistory = []; // Store performance history data

function initializePerformanceChart() {
  const ctx = document.getElementById('performanceChart');
  if (!ctx) return;

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
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Mastery Score'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Date'
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      }
    }
  });

  // Create letter toggle buttons
  createLetterToggles();
  
  // Load performance history
  loadPerformanceHistory();
}

// Load performance history data
async function loadPerformanceHistory() {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    
    const user = JSON.parse(userStr);
    
    const response = await fetch('/api/get-performance-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load history: ${response.status}`);
    }
    
    const result = await response.json();
    performanceHistory = result.history || [];
    
    // Update chart with current selections
    updatePerformanceChart(statsData);
  } catch (error) {
    console.error('Error loading performance history:', error);
    performanceHistory = [];
  }
}

// Create toggle buttons for each letter
function createLetterToggles() {
  const toggleGroup = document.getElementById('letterToggleGroup');
  if (!toggleGroup) return;

  toggleGroup.innerHTML = '';
  
  // Create a button for each letter
  for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-secondary';
    btn.textContent = char;
    btn.dataset.letter = char;
    btn.onclick = () => toggleLetter(char);
    toggleGroup.appendChild(btn);
  }
}

// Toggle letter visibility
function toggleLetter(letter) {
  letterVisibility[letter] = !letterVisibility[letter];
  
  // Update button style
  const btn = document.querySelector(`[data-letter="${letter}"]`);
  if (btn) {
    if (letterVisibility[letter]) {
      btn.classList.remove('btn-outline-secondary');
      btn.classList.add('btn-primary');
    } else {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline-secondary');
    }
  }

  // Update chart
  updatePerformanceChart(statsData);
}

// Select all letters
function selectAllLetters() {
  for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    letterVisibility[char] = true;
    const btn = document.querySelector(`[data-letter="${char}"]`);
    if (btn) {
      btn.classList.remove('btn-outline-secondary');
      btn.classList.add('btn-primary');
    }
  }
  updatePerformanceChart(statsData);
}

// Unselect all letters
function unselectAllLetters() {
  for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    letterVisibility[char] = false;
    const btn = document.querySelector(`[data-letter="${char}"]`);
    if (btn) {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline-secondary');
    }
  }
  updatePerformanceChart(statsData);
}

// Make functions globally available
window.selectAllLetters = selectAllLetters;
window.unselectAllLetters = unselectAllLetters;

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

  // Generate colors for each letter
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
    'rgb(99, 132, 255)'    // Light Blue
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

  // Create datasets for each visible letter
  const datasets = visibleLetters.map((letter, index) => {
    const color = colors[index % colors.length];
    const data = uniqueDates.map(date => {
      // Find the history record for this date
      const historyRecord = sortedHistory.find(h => h.recorded_at === date);
      if (!historyRecord || !historyRecord.stats) return 0;
      
      const letterStats = historyRecord.stats[letter];
      if (!letterStats) return 0;
      
      return letterStats.mastery || 0;
    });

    return {
      label: `Letter ${letter}`,
      data: data,
      borderColor: color,
      backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.2)'),
      tension: 0.4,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6
    };
  });

  // Update chart
  performanceChart.data.labels = formattedDates;
  performanceChart.data.datasets = datasets;
  performanceChart.update();
}

document.addEventListener('DOMContentLoaded', function() {
  displayCurrentUser();
  generateQRCode();
  initializePerformanceChart();
  displayUserStats();
  
  // Log dashboard access
  if (window.auditLog) {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      window.auditLog.logActivity('dashboard_access', 'Student accessed dashboard', user.id);
    }
  }

  // Regenerate QR code for mobile every time offcanvas is shown
  const sidebarOffcanvas = document.getElementById('sidebarOffcanvas');
  if (sidebarOffcanvas) {
    sidebarOffcanvas.addEventListener('shown.bs.offcanvas', function () {
      generateQRCode({ onlyMobile: true });
    });
  }

  // Attach sorting event listeners ONCE
  document.querySelectorAll('#userStatsTable th.sortable').forEach(th => {
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
