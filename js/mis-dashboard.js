let accounts = [];
let filteredAccounts = [];
let sections = [];
let filteredSections = [];
let auditLogs = [];
let filteredAuditLogs = [];
let currentAccount = null;

// Function to handle logout
async function logout() {
  try {
    let mis = localStorage.getItem('mis');
    if (!mis) {
      const user = localStorage.getItem('user');
      if (user) {
        const userData = JSON.parse(user);
        if (userData.role === 'mis') {
          mis = user;
        }
      }
    }
    
    const misData = mis ? JSON.parse(mis) : null;
    
    if (misData && window.auditLog) {
      await window.auditLog.logActivity('logout', `MIS ${misData.username} logged out`, misData.id);
    }
    
    localStorage.removeItem('mis');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  } catch (error) {
    alert('Logout failed: ' + (error.message || error));
    console.error('Error signing out:', error.message || error);
  }
}
window.logout = logout;

// Function to check if user is MIS
function checkMISAuth() {
  let mis = localStorage.getItem('mis');
  if (mis) {
    return JSON.parse(mis);
  }
  
  const user = localStorage.getItem('user');
  if (user) {
    const userData = JSON.parse(user);
    if (userData.role === 'mis') {
      localStorage.setItem('mis', JSON.stringify(userData));
      return userData;
    }
  }
  
  window.location.href = 'index.html';
  return false;
}

// Function to display MIS name
function displayMISName() {
  const mis = checkMISAuth();
  if (!mis) return;

  const misNameElement = document.getElementById('misName');
  if (misNameElement) {
    // Format as lastname, firstname (username)
    let displayName = '';
    if (mis.last_name && mis.first_name) {
      displayName = `${mis.last_name}, ${mis.first_name}`;
    } else if (mis.first_name) {
      displayName = mis.first_name;
    } else if (mis.last_name) {
      displayName = mis.last_name;
    } else {
      displayName = mis.username || 'MIS User';
    }
    
    if (mis.username) {
      displayName += ` (${mis.username})`;
    }
    
    misNameElement.textContent = `Welcome! ${displayName}`;
    misNameElement.style.color = 'white';
  }
}

// Function to load all accounts
async function loadAccounts() {
  try {
    const response = await authenticatedFetch('/api/mis-account-management', {
      method: 'POST',
      body: JSON.stringify({ action: 'get-students' })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load accounts: ${response.status}`);
    }

    const result = await response.json();
    accounts = result.users || [];
    filteredAccounts = [];
    
    filterAccounts();
  } catch (error) {
    console.error('Error loading accounts:', error);
    const tbody = document.getElementById('accountsList');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading accounts: ' + error.message + '</td></tr>';
    }
  }
}

// Function to filter accounts
function filterAccounts() {
  const searchTerm = document.getElementById('accountSearch').value.toLowerCase().trim();
  const roleFilter = document.getElementById('accountRoleFilter').value;
  
  filteredAccounts = accounts.filter(account => {
    const matchesSearch = !searchTerm || 
      account.username.toLowerCase().includes(searchTerm) ||
      account.email.toLowerCase().includes(searchTerm) ||
      (account.first_name && account.first_name.toLowerCase().includes(searchTerm)) ||
      (account.last_name && account.last_name.toLowerCase().includes(searchTerm));
    
    const matchesRole = roleFilter === 'all' || account.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });
  
  renderAccounts();
}

// Function to render accounts
function renderAccounts() {
  const tbody = document.getElementById('accountsList');
  tbody.innerHTML = '';

  if (filteredAccounts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No accounts found.</td></tr>';
    return;
  }

  filteredAccounts.forEach(account => {
    const row = document.createElement('tr');
    // Format as last_name, first_name (username) for all accounts
    let displayName;
    if (account.last_name && account.first_name) {
      displayName = `${account.last_name}, ${account.first_name} (${account.username || account.email})`;
    } else if (account.first_name) {
      displayName = `${account.first_name} (${account.username || account.email})`;
    } else if (account.last_name) {
      displayName = `${account.last_name} (${account.username || account.email})`;
    } else {
      displayName = account.username || account.email || 'Unknown';
    }
    
    // Get role badge color
    const roleBadge = getRoleBadge(account.role || 'student');
    
    row.innerHTML = `
      <td>${displayName}</td>
      <td>${account.email}</td>
      <td>${roleBadge}</td>
      <td>${account.created_at ? new Date(account.created_at).toLocaleDateString() : 'N/A'}</td>
      <td class="text-end">
        <div class="d-flex gap-2 justify-content-end">
          <button class="btn btn-sm btn-primary" onclick="showEditAccountModal('${account.uuid}')">Edit</button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteAccount('${account.uuid}', '${account.username}')">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Function to get role badge with different colors
function getRoleBadge(role) {
  const badges = {
    student: '<span class="badge bg-success">Student</span>',
    teacher: '<span class="badge bg-info">Teacher</span>',
    mis: '<span class="badge bg-warning text-dark">MIS</span>'
  };
  return badges[role] || '<span class="badge bg-secondary">' + role + '</span>';
}

// Function to show create account modal
function showCreateAccountModal() {
  // Get references before reset
  const usernameInput = document.getElementById('createUsername');
  const emailInput = document.getElementById('createEmail');
  const passwordInput = document.getElementById('createPassword');
  
  // Reset form
  document.getElementById('createAccountForm').reset();
  document.getElementById('createRole').value = '';
  
  // Clear auto-generated fields
  usernameInput.value = '';
  emailInput.value = '';
  passwordInput.value = '';
  
  // Make fields readonly by default (before role selection)
  // Use both setAttribute and readonly property to ensure it sticks
  usernameInput.setAttribute('readonly', 'readonly');
  emailInput.setAttribute('readonly', 'readonly');
  passwordInput.setAttribute('readonly', 'readonly');
  usernameInput.readOnly = true;
  emailInput.readOnly = true;
  passwordInput.readOnly = true;
  
  // Hide password toggle button initially
  document.getElementById('togglePassword').style.display = 'none';
  
  updateCreateFormFields();
  const modal = new bootstrap.Modal(document.getElementById('createAccountModal'));
  modal.show();
  
  // Ensure readonly is maintained after modal shows (in case form reset cleared it)
  setTimeout(() => {
    if (!document.getElementById('createRole').value) {
      // No role selected, keep readonly
      usernameInput.setAttribute('readonly', 'readonly');
      emailInput.setAttribute('readonly', 'readonly');
      passwordInput.setAttribute('readonly', 'readonly');
      usernameInput.readOnly = true;
      emailInput.readOnly = true;
      passwordInput.readOnly = true;
    }
  }, 100);
}

// Function to update create form fields based on role
async function updateCreateFormFields() {
  const role = document.getElementById('createRole').value;
  const studentIdContainer = document.getElementById('createStudentIdContainer');
  const teacherIdContainer = document.getElementById('createTeacherIdContainer');
  const misIdContainer = document.getElementById('createMisIdContainer');
  const studentIdInput = document.getElementById('createStudentId');
  const teacherIdInput = document.getElementById('createTeacherId');
  const misIdInput = document.getElementById('createMisId');
  const lastNameInput = document.getElementById('createLastName');
  const usernameInput = document.getElementById('createUsername');
  const emailInput = document.getElementById('createEmail');
  const passwordInput = document.getElementById('createPassword');
  const togglePasswordBtn = document.getElementById('togglePassword');

  // Reset all ID fields
  studentIdInput.value = '';
  teacherIdInput.value = '';
  misIdInput.value = '';
  studentIdInput.removeAttribute('required');
  teacherIdInput.removeAttribute('required');

  if (role === 'student') {
    studentIdContainer.style.display = 'block';
    teacherIdContainer.style.display = 'none';
    misIdContainer.style.display = 'none';
    studentIdInput.setAttribute('required', 'required');
    // Make fields readonly for student
    usernameInput.setAttribute('readonly', 'readonly');
    emailInput.setAttribute('readonly', 'readonly');
    passwordInput.setAttribute('readonly', 'readonly');
    usernameInput.readOnly = true;
    emailInput.readOnly = true;
    passwordInput.readOnly = true;
    togglePasswordBtn.style.display = 'block';
    // Set up auto-generation for student
    setupAutoGeneration('student');
  } else if (role === 'teacher') {
    studentIdContainer.style.display = 'none';
    teacherIdContainer.style.display = 'block';
    misIdContainer.style.display = 'none';
    teacherIdInput.setAttribute('required', 'required');
    // Make fields readonly for teacher
    usernameInput.setAttribute('readonly', 'readonly');
    emailInput.setAttribute('readonly', 'readonly');
    passwordInput.setAttribute('readonly', 'readonly');
    usernameInput.readOnly = true;
    emailInput.readOnly = true;
    passwordInput.readOnly = true;
    togglePasswordBtn.style.display = 'block';
    // Set up auto-generation for teacher
    setupAutoGeneration('teacher');
  } else if (role === 'mis') {
    studentIdContainer.style.display = 'none';
    teacherIdContainer.style.display = 'none';
    misIdContainer.style.display = 'block';
    // Auto-generate sequential MIS ID (function now handles errors gracefully)
    const misId = await generateSequentialMisId();
    misIdInput.value = misId;
    // Clear auto-generated fields for MIS and make them editable
    usernameInput.value = '';
    emailInput.value = '';
    passwordInput.value = '';
    usernameInput.removeAttribute('readonly');
    emailInput.removeAttribute('readonly');
    passwordInput.removeAttribute('readonly');
    usernameInput.readOnly = false;
    emailInput.readOnly = false;
    passwordInput.readOnly = false;
    togglePasswordBtn.style.display = 'block';
  } else {
    // No role selected - keep fields readonly by default
    studentIdContainer.style.display = 'none';
    teacherIdContainer.style.display = 'none';
    misIdContainer.style.display = 'none';
    // Clear auto-generated fields but keep readonly
    usernameInput.value = '';
    emailInput.value = '';
    passwordInput.value = '';
    usernameInput.setAttribute('readonly', 'readonly');
    emailInput.setAttribute('readonly', 'readonly');
    passwordInput.setAttribute('readonly', 'readonly');
    usernameInput.readOnly = true;
    emailInput.readOnly = true;
    passwordInput.readOnly = true;
    togglePasswordBtn.style.display = 'none';
  }
}

// Function to set up auto-generation for student/teacher
function setupAutoGeneration(roleType) {
  const studentIdInput = document.getElementById('createStudentId');
  const teacherIdInput = document.getElementById('createTeacherId');
  const lastNameInput = document.getElementById('createLastName');
  
  // Remove existing listeners by cloning
  const newStudentId = studentIdInput.cloneNode(true);
  const newTeacherId = teacherIdInput.cloneNode(true);
  const newLastName = lastNameInput.cloneNode(true);
  studentIdInput.parentNode.replaceChild(newStudentId, studentIdInput);
  teacherIdInput.parentNode.replaceChild(newTeacherId, teacherIdInput);
  lastNameInput.parentNode.replaceChild(newLastName, lastNameInput);
  
  // Add new listeners
  if (roleType === 'student') {
    document.getElementById('createStudentId').addEventListener('input', generateStudentTeacherCredentials);
  } else {
    document.getElementById('createTeacherId').addEventListener('input', generateStudentTeacherCredentials);
  }
  document.getElementById('createLastName').addEventListener('input', generateStudentTeacherCredentials);
}

// Function to generate username, email, and password for student/teacher
function generateStudentTeacherCredentials() {
  const role = document.getElementById('createRole').value;
  const lastName = document.getElementById('createLastName').value.trim().toLowerCase();
  const studentId = document.getElementById('createStudentId').value.trim();
  const teacherId = document.getElementById('createTeacherId').value.trim();
  const usernameInput = document.getElementById('createUsername');
  const emailInput = document.getElementById('createEmail');
  const passwordInput = document.getElementById('createPassword');

  // Only generate if we have both last name and ID
  if (role === 'student' && studentId && lastName) {
    const id = studentId;
    usernameInput.value = `${lastName}.${id}`;
    emailInput.value = `${lastName}.${id}@aeyebraille.online`;
    passwordInput.value = `${lastName}${id}`;
    // Ensure fields remain readonly after value update
    usernameInput.setAttribute('readonly', 'readonly');
    emailInput.setAttribute('readonly', 'readonly');
    passwordInput.setAttribute('readonly', 'readonly');
    usernameInput.readOnly = true;
    emailInput.readOnly = true;
    passwordInput.readOnly = true;
  } else if (role === 'teacher' && teacherId && lastName) {
    const id = teacherId;
    usernameInput.value = `${lastName}.${id}`;
    emailInput.value = `${lastName}.${id}@aeyebraille.online`;
    passwordInput.value = `${lastName}${id}`;
    // Ensure fields remain readonly after value update
    usernameInput.setAttribute('readonly', 'readonly');
    emailInput.setAttribute('readonly', 'readonly');
    passwordInput.setAttribute('readonly', 'readonly');
    usernameInput.readOnly = true;
    emailInput.readOnly = true;
    passwordInput.readOnly = true;
  } else {
    // Clear if not enough info (but keep readonly for student/teacher roles)
    if (role === 'student' || role === 'teacher') {
      usernameInput.value = '';
      emailInput.value = '';
      passwordInput.value = '';
      // Keep fields readonly even when empty
      usernameInput.setAttribute('readonly', 'readonly');
      emailInput.setAttribute('readonly', 'readonly');
      passwordInput.setAttribute('readonly', 'readonly');
      usernameInput.readOnly = true;
      emailInput.readOnly = true;
      passwordInput.readOnly = true;
    }
  }
}

// Function to toggle password visibility
function togglePasswordVisibility(passwordFieldId, toggleButtonId) {
  const passwordInput = document.getElementById(passwordFieldId);
  const toggleIcon = document.getElementById(toggleButtonId + 'Icon');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleIcon.classList.remove('bi-eye');
    toggleIcon.classList.add('bi-eye-slash');
  } else {
    passwordInput.type = 'password';
    toggleIcon.classList.remove('bi-eye-slash');
    toggleIcon.classList.add('bi-eye');
  }
}

// Function to generate sequential MIS ID
async function generateSequentialMisId() {
  try {
    const response = await authenticatedFetch('/api/mis-account-management', {
      method: 'POST',
      body: JSON.stringify({
        action: 'get-next-mis-id'
      })
    });

    if (!response.ok) {
      // If API fails, return a default ID
      console.warn('Failed to get next MIS ID from API, using default');
      return 'MIS001';
    }

    const result = await response.json();
    if (result.misId) {
      return result.misId;
    } else {
      // Fallback if misId is not in response
      return 'MIS001';
    }
  } catch (error) {
    console.error('Error generating sequential MIS ID:', error);
    // Return a default ID instead of throwing error
    return 'MIS001';
  }
}

// Function to create account
async function createAccount() {
  const role = document.getElementById('createRole').value.trim();
  const studentId = document.getElementById('createStudentId').value.trim();
  const teacherId = document.getElementById('createTeacherId').value.trim();
  const misId = document.getElementById('createMisId').value.trim();
  const username = document.getElementById('createUsername').value.trim();
  const email = document.getElementById('createEmail').value.trim();
  const password = document.getElementById('createPassword').value.trim();
  const firstName = document.getElementById('createFirstName').value.trim();
  const lastName = document.getElementById('createLastName').value.trim();

  // Validate role is selected
  if (!role) {
    alert('Please select a role');
    return;
  }

  // Validate required fields
  if (!username || !email || !password || !firstName || !lastName) {
    alert('Please fill in all required fields');
    return;
  }

  // Validate ID fields based on role
  if (role === 'student') {
    if (!studentId) {
      alert('Student ID is required');
      return;
    }
    if (!/^\d{12}$/.test(studentId)) {
      alert('Student ID must be exactly 12 digits');
      return;
    }
  } else if (role === 'teacher') {
    if (!teacherId) {
      alert('Teacher ID is required');
      return;
    }
    if (!/^\d{7}$/.test(teacherId)) {
      alert('Teacher ID must be exactly 7 digits');
      return;
    }
  } else if (role === 'mis') {
    if (!misId) {
      alert('MIS ID is required (should be auto-generated)');
      return;
    }
    
    // Check MIS account limit (maximum 3) - frontend validation
    const misAccounts = accounts.filter(acc => acc.role === 'mis');
    if (misAccounts.length >= 3) {
      alert('Maximum of 3 MIS accounts allowed. Cannot create more MIS accounts.');
      return;
    }
  }

  try {
    const mis = checkMISAuth();
    if (!mis) return;

    const response = await authenticatedFetch('/api/mis-account-management', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create',
        accountData: {
          username,
          email,
          password,
          role,
          firstName,
          lastName,
          studentId: studentId || undefined,
          teacherId: teacherId || undefined,
          misId: misId || undefined
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to create account');
    }

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('createAccountModal'));
    modal.hide();

    // Reload accounts
    await loadAccounts();

    // Log activity with USER_CREATED
    if (window.auditLog) {
      const accountInfo = result.user;
      const displayName = accountInfo.last_name && accountInfo.first_name 
        ? `${accountInfo.last_name}, ${accountInfo.first_name} (${accountInfo.username})`
        : accountInfo.username;
      await window.auditLog.logActivity('USER_CREATED', `Created ${role} account: ${displayName}`, mis.id);
    }

    alert('Account created successfully!');
  } catch (error) {
    console.error('Error creating account:', error);
    alert('Failed to create account: ' + error.message);
  }
}

// Function to show edit account modal
function showEditAccountModal(userId) {
  currentAccount = accounts.find(a => a.uuid === userId);
  if (!currentAccount) {
    alert('Account not found');
    return;
  }

  document.getElementById('editUsername').value = currentAccount.username || '';
  document.getElementById('editEmail').value = currentAccount.email || '';
  document.getElementById('editPassword').value = '';
  document.getElementById('editFirstName').value = currentAccount.first_name || '';
  document.getElementById('editLastName').value = currentAccount.last_name || '';
  document.getElementById('editRole').value = '';
  
  // Populate ID fields based on current role
  document.getElementById('editStudentId').value = '';
  document.getElementById('editTeacherId').value = '';
  document.getElementById('editMisId').value = '';
  
  // Extract IDs from account data (assuming they're stored separately or in a field)
  // For now, we'll need to get them from the account object if available
  if (currentAccount.student_id) {
    document.getElementById('editStudentId').value = currentAccount.student_id;
  } else if (currentAccount.role === 'student' && /^\d{12}$/.test(currentAccount.username)) {
    // Fallback: if student ID was stored in username (legacy)
    document.getElementById('editStudentId').value = currentAccount.username;
  }
  
  if (currentAccount.teacher_id) {
    document.getElementById('editTeacherId').value = currentAccount.teacher_id;
  } else if (currentAccount.role === 'teacher' && /^\d{7}$/.test(currentAccount.username)) {
    // Fallback: if teacher ID was stored in username (legacy)
    document.getElementById('editTeacherId').value = currentAccount.username;
  }
  
  if (currentAccount.mis_id) {
    document.getElementById('editMisId').value = currentAccount.mis_id;
  }

  // Update form fields to show appropriate fields based on current role
  updateEditFormFields();
  const modal = new bootstrap.Modal(document.getElementById('editAccountModal'));
  modal.show();
}

// Function to update edit form fields based on role
function updateEditFormFields() {
  const role = document.getElementById('editRole').value;
  const studentIdContainer = document.getElementById('editStudentIdContainer');
  const teacherIdContainer = document.getElementById('editTeacherIdContainer');
  const misIdContainer = document.getElementById('editMisIdContainer');
  const studentIdInput = document.getElementById('editStudentId');
  const teacherIdInput = document.getElementById('editTeacherId');

  // If no role change selected, show fields based on current account role
  const currentRole = role || currentAccount?.role;

  if (currentRole === 'student') {
    studentIdContainer.style.display = 'block';
    teacherIdContainer.style.display = 'none';
    misIdContainer.style.display = 'none';
    if (role) { // Only require if changing role
      studentIdInput.setAttribute('required', 'required');
    }
  } else if (currentRole === 'teacher') {
    studentIdContainer.style.display = 'none';
    teacherIdContainer.style.display = 'block';
    misIdContainer.style.display = 'none';
    if (role) { // Only require if changing role
      teacherIdInput.setAttribute('required', 'required');
    }
  } else if (currentRole === 'mis') {
    studentIdContainer.style.display = 'none';
    teacherIdContainer.style.display = 'none';
    misIdContainer.style.display = 'block';
    studentIdInput.removeAttribute('required');
    teacherIdInput.removeAttribute('required');
  } else {
    studentIdContainer.style.display = 'none';
    teacherIdContainer.style.display = 'none';
    misIdContainer.style.display = 'none';
    studentIdInput.removeAttribute('required');
    teacherIdInput.removeAttribute('required');
  }
}

// Function to update account
async function updateAccount() {
  if (!currentAccount) {
    alert('No account selected');
    return;
  }

  const role = document.getElementById('editRole').value.trim();
  const studentId = document.getElementById('editStudentId').value.trim();
  const teacherId = document.getElementById('editTeacherId').value.trim();
  const misId = document.getElementById('editMisId').value.trim();
  const username = document.getElementById('editUsername').value.trim();
  const email = document.getElementById('editEmail').value.trim();
  const password = document.getElementById('editPassword').value.trim();
  const firstName = document.getElementById('editFirstName').value.trim();
  const lastName = document.getElementById('editLastName').value.trim();

  // Determine new role (if changing)
  let newRole = role || null;
  const targetRole = role || currentAccount.role;

  // Validate ID fields if role is being changed
  if (role) {
    if (role === 'student') {
      if (!studentId) {
        alert('Student ID is required when changing to student role');
        return;
      }
      if (!/^\d{12}$/.test(studentId)) {
        alert('Student ID must be exactly 12 digits');
        return;
      }
    } else if (role === 'teacher') {
      if (!teacherId) {
        alert('Teacher ID is required when changing to teacher role');
        return;
      }
      if (!/^\d{7}$/.test(teacherId)) {
        alert('Teacher ID must be exactly 7 digits');
        return;
      }
    } else if (role === 'mis') {
      // MIS ID should already be set, no need to generate username
      // Username is separate from MIS ID
    }
  } else {
    // If not changing role, validate IDs match current role
    if (currentAccount.role === 'student' && studentId && !/^\d{12}$/.test(studentId)) {
      alert('Student ID must be exactly 12 digits');
      return;
    }
    if (currentAccount.role === 'teacher' && teacherId && !/^\d{7}$/.test(teacherId)) {
      alert('Teacher ID must be exactly 7 digits');
      return;
    }
  }

  const accountData = {};
  if (username) accountData.username = username;
  if (email) accountData.email = email;
  if (password) accountData.password = password;
  if (firstName !== '') accountData.firstName = firstName;
  if (lastName !== '') accountData.lastName = lastName;
      if (newRole) accountData.role = newRole;
      if (studentId) accountData.studentId = studentId;
      if (teacherId) accountData.teacherId = teacherId;
      if (misId) accountData.misId = misId;
      if (username && username !== currentAccount.username) {
        accountData.username = username;
      }

  if (Object.keys(accountData).length === 0) {
    alert('Please enter at least one field to update');
    return;
  }

  try {
    const mis = checkMISAuth();
    if (!mis) return;

    const response = await authenticatedFetch('/api/mis-account-management', {
      method: 'POST',
      body: JSON.stringify({
        action: 'update',
        userId: currentAccount.uuid,
        accountData
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to update account');
    }

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('editAccountModal'));
    modal.hide();

    // Reload accounts
    await loadAccounts();

    // Log activity with detailed change tracking
    if (window.auditLog) {
      const changes = [];
      
      // Track username changes
      if (username && username !== currentAccount.username) {
        changes.push(`Username: "${currentAccount.username}" → "${username}"`);
      }
      
      // Track first name changes
      if (firstName !== '' && firstName !== currentAccount.first_name) {
        changes.push(`First Name: "${currentAccount.first_name || '(empty)'}" → "${firstName}"`);
      }
      
      // Track last name changes
      if (lastName !== '' && lastName !== currentAccount.last_name) {
        changes.push(`Last Name: "${currentAccount.last_name || '(empty)'}" → "${lastName}"`);
      }
      
      // Track email changes
      if (email && email !== currentAccount.email) {
        changes.push(`Email: "${currentAccount.email}" → "${email}"`);
      }
      
      // Track role changes
      if (newRole && newRole !== currentAccount.role) {
        changes.push(`Role: "${currentAccount.role}" → "${newRole}"`);
      }
      
      // Track password changes
      if (password) {
        changes.push('Password: changed');
      }
      
      if (changes.length > 0) {
        const details = changes.join(' | ');
        await window.auditLog.logActivity('USER_UPDATED', `Updated account ${currentAccount.username}: ${details}`, mis.id);
      }
    }

    alert('Account updated successfully!');
  } catch (error) {
    console.error('Error updating account:', error);
    alert('Failed to update account: ' + error.message);
  }
}

// Function to delete account
async function deleteAccount(userId, username) {
  // Check if deleting an MIS account and validate minimum limit
  const accountToDelete = accounts.find(acc => acc.uuid === userId);
  if (accountToDelete && accountToDelete.role === 'mis') {
    const misAccounts = accounts.filter(acc => acc.role === 'mis');
    if (misAccounts.length <= 2) {
      alert('Minimum of 2 MIS accounts required. Cannot delete this MIS account.');
      return;
    }
  }
  
  if (!confirm(`Are you sure you want to delete the account "${username}"?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    const mis = checkMISAuth();
    if (!mis) return;

    const response = await authenticatedFetch('/api/mis-account-management', {
      method: 'POST',
      body: JSON.stringify({
        action: 'delete',
        userId
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to delete account');
    }

    // Reload accounts
    await loadAccounts();

    // Log activity with USER_DELETED
    if (window.auditLog) {
      await window.auditLog.logActivity('USER_DELETED', `Deleted account: ${username}`, mis.id);
    }

    alert('Account deleted successfully!');
  } catch (error) {
    console.error('Error deleting account:', error);
    alert('Failed to delete account: ' + error.message);
  }
}

// Function to load all sections
async function loadSections() {
  try {
    const response = await authenticatedFetch('/api/sections', {
      method: 'POST',
      body: JSON.stringify({ action: 'get-sections', all: true })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load sections: ${response.status}`);
    }

    const result = await response.json();
    sections = result.sections || [];
    filteredSections = [];
    
    filterSections();
  } catch (error) {
    console.error('Error loading sections:', error);
    const tbody = document.getElementById('sectionsList');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading sections: ' + error.message + '</td></tr>';
    }
  }
}

// Function to filter sections
function filterSections() {
  const searchTerm = document.getElementById('sectionSearch').value.toLowerCase().trim();
  
  filteredSections = sections.filter(section => 
    !searchTerm || 
    section.name.toLowerCase().includes(searchTerm) ||
    section.code.toLowerCase().includes(searchTerm) ||
    (section.teacher && section.teacher.username.toLowerCase().includes(searchTerm))
  );
  
  renderSections();
}

// Function to render sections
function renderSections() {
  const tbody = document.getElementById('sectionsList');
  tbody.innerHTML = '';

  if (filteredSections.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No sections found.</td></tr>';
    return;
  }

  filteredSections.forEach(section => {
    const row = document.createElement('tr');
    const teacherName = section.teacher ? section.teacher.username : 'N/A';
    
    row.innerHTML = `
      <td>${section.name}</td>
      <td><code class="text-primary">${section.code}</code></td>
      <td>${teacherName}</td>
      <td><span class="badge bg-primary">${section.student_count || 0}</span></td>
      <td>${section.created_at ? new Date(section.created_at).toLocaleDateString() : 'N/A'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-primary" onclick="viewSectionStudents('${section.id}', '${section.name.replace(/'/g, "\\'")}')" title="View Students">
          <i class="bi bi-eye"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Function to view students in a section
async function viewSectionStudents(sectionId, sectionName) {
  try {
    const response = await authenticatedFetch('/api/sections', {
      method: 'POST',
      body: JSON.stringify({ action: 'get-students', sectionId })
    });

    if (!response.ok) {
      throw new Error(`Failed to load students: ${response.status}`);
    }

    const result = await response.json();
    const students = result.students || [];

    // Update modal title
    document.getElementById('sectionStudentsModalLabel').textContent = `Students in ${sectionName}`;
    
    // Render students
    const tbody = document.getElementById('sectionStudentsModalBody');
    tbody.innerHTML = '';

    if (students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No students in this section.</td></tr>';
    } else {
      students.forEach(student => {
        const row = document.createElement('tr');
        const studentName = formatStudentNameForMIS(student);
        row.innerHTML = `
          <td>${studentName}</td>
          <td>${student.email || 'N/A'}</td>
          <td>${student.joined_at ? new Date(student.joined_at).toLocaleDateString() : 'N/A'}</td>
        `;
        tbody.appendChild(row);
      });
    }

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('sectionStudentsModal'));
    modal.show();
  } catch (error) {
    console.error('Error loading section students:', error);
    alert('Failed to load students: ' + error.message);
  }
}

// Helper function to format student name for MIS view
function formatStudentNameForMIS(student) {
  if (student.last_name && student.first_name) {
    return `${student.last_name}, ${student.first_name} (${student.username || student.email})`;
  } else if (student.first_name) {
    return `${student.first_name} (${student.username || student.email})`;
  } else if (student.last_name) {
    return `${student.last_name} (${student.username || student.email})`;
  } else {
    return student.username || student.email || 'Unknown';
  }
}

// Function to load audit logs
async function loadAuditLogs() {
  try {
    const response = await authenticatedFetch('/api/audit', {
      method: 'POST',
      body: JSON.stringify({ action: 'get-all' }) // No userId = get all (MIS only)
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to load audit logs');
    }

    auditLogs = result.logs || [];
    filteredAuditLogs = [...auditLogs];
    renderAuditLogs();
  } catch (error) {
    console.error('Error loading audit logs:', error);
    document.getElementById('auditLogList').innerHTML = 
      `<tr><td colspan="3" class="text-center text-danger">Error loading audit logs: ${error.message}</td></tr>`;
  }
}

// Function to render audit logs
function renderAuditLogs() {
  const tbody = document.getElementById('auditLogList');
  tbody.innerHTML = '';

  if (filteredAuditLogs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No audit logs found.</td></tr>';
    return;
  }

  filteredAuditLogs.forEach(log => {
    const row = document.createElement('tr');
    
    // Format timestamp to GMT+8 for display (data stored in UTC)
    const timestamp = new Date(log.timestamp);
    const formattedDate = timestamp.toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Get activity badge
    const activityBadge = getAuditActivityBadge(log.activity);
    
    row.innerHTML = `
      <td>${formattedDate}</td>
      <td>${activityBadge}</td>
      <td>${log.details || ''}</td>
    `;
    tbody.appendChild(row);
  });
}

// Function to get activity badge for audit logs
function getAuditActivityBadge(activity) {
  const badges = {
    'login': '<span class="badge bg-success">LOGIN</span>',
    'logout': '<span class="badge bg-warning text-dark">LOGOUT</span>',
    'USER_CREATED': '<span class="badge bg-success">USER_CREATED</span>',
    'USER_DELETED': '<span class="badge bg-danger">USER_DELETED</span>',
    'USER_UPDATED': '<span class="badge bg-warning text-dark">USER_UPDATED</span>',
    'SECTION_CREATED': '<span class="badge bg-info">SECTION_CREATED</span>',
    'SECTION_DELETED': '<span class="badge bg-danger">SECTION_DELETED</span>',
    'STUDENT_ADDED': '<span class="badge bg-primary">STUDENT_ADDED</span>',
    'STUDENT_REMOVED': '<span class="badge bg-secondary">STUDENT_REMOVED</span>',
    // Legacy lowercase support
    'section_created': '<span class="badge bg-info">SECTION_CREATED</span>',
    'section_deleted': '<span class="badge bg-danger">SECTION_DELETED</span>',
    'dashboard_access': '<span class="badge bg-info">LOGIN</span>' // Legacy support - treat as login
  };
  return badges[activity] || `<span class="badge bg-secondary">${activity}</span>`;
}

// Function to filter audit logs
function filterAuditLogs() {
  const searchTerm = document.getElementById('auditSearch').value.toLowerCase().trim();
  const activityFilter = document.getElementById('auditActivityFilter').value;

  filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch = !searchTerm || 
      (log.details && log.details.toLowerCase().includes(searchTerm)) ||
      (log.activity && log.activity.toLowerCase().includes(searchTerm));
    
    const matchesActivity = activityFilter === 'all' || log.activity === activityFilter;
    
    return matchesSearch && matchesActivity;
  });

  renderAuditLogs();
}

// Make functions globally available
window.showCreateAccountModal = showCreateAccountModal;
window.createAccount = createAccount;
window.showEditAccountModal = showEditAccountModal;
window.updateAccount = updateAccount;
window.deleteAccount = deleteAccount;
window.filterAccounts = filterAccounts;
window.filterSections = filterSections;
window.viewSectionStudents = viewSectionStudents;
window.updateCreateFormFields = updateCreateFormFields;
window.updateEditFormFields = updateEditFormFields;
window.togglePasswordVisibility = togglePasswordVisibility;
window.loadAuditLogs = loadAuditLogs;
window.filterAuditLogs = filterAuditLogs;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  const mis = checkMISAuth();
  if (!mis) return;

  displayMISName();
  loadAccounts();
  loadSections();

  // Load sections when sections tab is clicked
  document.getElementById('sections-tab').addEventListener('shown.bs.tab', async function() {
    await loadSections();
  });
  
  // Load audit logs when audit tab is clicked
  const auditTab = document.getElementById('audit-tab');
  if (auditTab) {
    auditTab.addEventListener('shown.bs.tab', async function() {
      if (auditLogs.length === 0) {
        await loadAuditLogs();
      }
    });
  }

});

