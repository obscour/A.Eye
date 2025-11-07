// Supabase client init - uses config from config.js
const supabase = window.supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.key
);

function toggleForms() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const formTitle = document.getElementById('formTitle');
  const errorMessage = document.getElementById('error-message');
  const successMessage = document.getElementById('success-message');
  errorMessage.style.display = 'none';
  errorMessage.textContent = '';
  successMessage.style.display = 'none';
  successMessage.textContent = '';
  if (loginForm.style.display === 'none') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    formTitle.textContent = 'Login';
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    formTitle.textContent = 'Register';
  }
}
window.toggleForms = toggleForms;

// Function to handle account type selection
function selectAccountType(type) {
  // Remove selected class from all cards
  document.querySelectorAll('.account-type-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  // Add selected class to clicked card
  const selectedCard = document.getElementById(type + 'Card');
  if (selectedCard) {
    selectedCard.classList.add('selected');
  }
  
  // Update the radio button
  const radioButton = document.getElementById(type + 'Type');
  if (radioButton) {
    radioButton.checked = true;
  }
}
window.selectAccountType = selectAccountType;

document.addEventListener('DOMContentLoaded', function() {
  // Initialize account type selection
  selectAccountType('student');
  
  // LOGIN
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('loginIdentifier').value.trim();
      const password = document.getElementById('password').value;
      const errorMessage = document.getElementById('error-message');
      const successMessage = document.getElementById('success-message');
      errorMessage.style.display = 'none';
      errorMessage.textContent = '';
      successMessage.style.display = 'none';
      successMessage.textContent = '';
      try {
        // Custom login logic - check users table directly
        let userData;
        
        console.log('Attempting login with:', identifier);
        
        if (identifier.includes('@')) {
          // Login with email
          console.log('Looking up user by email:', identifier);
          const { data, error } = await supabase
            .from('users')
            .select('uuid, email, username, password, role')
            .eq('email', identifier)
            .single();
          
          console.log('Email lookup result:', { data, error });
          
          if (error || !data) {
            throw new Error('No user found with that email');
          }
          userData = data;
        } else {
          // Login with username
          console.log('Looking up user by username:', identifier);
          const { data, error } = await supabase
            .from('users')
            .select('uuid, email, username, password, role')
            .eq('username', identifier)
            .single();
          
          console.log('Username lookup result:', { data, error });
          
          if (error || !data) {
            throw new Error('No user found with that username');
          }
          userData = data;
        }
        
        console.log('Found user data:', userData);
        console.log('Checking password. Provided:', password, 'Stored:', userData.password);
        
        // Check password (simple comparison for now)
        if (userData.password !== password) {
          throw new Error('Invalid password');
        }
        
        console.log('Password match! Storing user session...');
        
        // Check user role from database
        const isTeacher = userData.role === 'teacher';
        
        if (isTeacher) {
          // Store teacher session
          localStorage.setItem('teacher', JSON.stringify({
            id: userData.uuid,
            email: userData.email,
            username: userData.username,
            role: userData.role
          }));
          console.log('Teacher session stored, redirecting to teacher dashboard...');
          
          // Log teacher login
          if (window.auditLog) {
            await window.auditLog.logActivity('login', `Teacher ${userData.username} logged in`, userData.uuid);
          }
          
          window.location.href = 'teacher-dashboard.html';
        } else {
          // Store regular user session
          localStorage.setItem('user', JSON.stringify({
            id: userData.uuid,
            email: userData.email,
            username: userData.username,
            role: userData.role || 'student'
          }));
          console.log('User session stored, redirecting to dashboard...');
          
          // Log user login
          if (window.auditLog) {
            await window.auditLog.logActivity('login', `Student ${userData.username} logged in`, userData.uuid);
          }
          
          window.location.href = 'dashboard.html';
        }
      } catch (error) {
        console.error('Login error:', error);
        errorMessage.style.display = 'block';
        errorMessage.textContent = error.message || 'Login failed. Please check your credentials.';
      }
    });
  }

  // REGISTER
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const firstName = document.getElementById('firstName').value;
      const lastName = document.getElementById('lastName').value;
      const username = document.getElementById('registerUsername').value;
      const email = document.getElementById('registerEmail').value;
      const password = document.getElementById('registerPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const accountType = document.querySelector('input[name="accountType"]:checked').value;
      const errorMessage = document.getElementById('error-message');
      const successMessage = document.getElementById('success-message');
      errorMessage.style.display = 'none';
      errorMessage.textContent = '';
      successMessage.style.display = 'none';
      successMessage.textContent = '';
      if (password !== confirmPassword) {
        errorMessage.style.display = 'block';
        errorMessage.textContent = 'Passwords do not match';
        return;
      }
      try {
        // Check if username or email already exists
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('username, email')
          .or(`username.eq.${username},email.eq.${email}`);
        
        // Handle the case where no user exists (checkError is expected)
        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }
        
        if (existingUser && existingUser.length > 0) {
          const existing = existingUser[0];
          if (existing.username === username) {
            throw new Error('Username already exists');
          }
          if (existing.email === email) {
            throw new Error('Email already exists');
          }
        }

        // Create initial stats JSON structure for A-Z
        const initialStats = {};
        for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
          initialStats[char] = {
            streak: 0,
            correct: 0,
            mastery: 0,
            attempts: 0
          };
        }

        // Generate a UUID for the new user
        const uuid = crypto.randomUUID();

        // Insert directly into users table
        const { error: insertError } = await supabase
          .from('users')
          .insert([{ 
            uuid: uuid,
            email, 
            username, 
            password: password,
            role: accountType, // Add role field
            stats: initialStats
          }]);
        
        if (insertError) throw insertError;

        // Log registration activity
        if (window.auditLog) {
          await window.auditLog.logActivity('register', `User ${username} registered as ${accountType}`, uuid);
        }

        errorMessage.style.display = 'none';
        successMessage.style.display = 'block';
        successMessage.textContent = 'Registration successful! Please login.';
        document.getElementById('registerForm').reset();
        setTimeout(() => { toggleForms(); }, 2000);
      } catch (error) {
        errorMessage.style.display = 'block';
        errorMessage.textContent = error.message || 'Registration failed.';
      }
    });
  }
});
