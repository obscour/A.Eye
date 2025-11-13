// verify-email.js — handles email verification

// Get token from URL
function getTokenFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

// Display error or success message
function showMessage(type, text) {
  const loadingMsg = document.getElementById('loading-message');
  const errorMsg = document.getElementById('error-message');
  const successMsg = document.getElementById('success-message');
  
  loadingMsg.style.display = 'none';
  errorMsg.style.display = 'none';
  successMsg.style.display = 'none';
  
  if (type === 'error') {
    errorMsg.textContent = text;
    errorMsg.style.display = 'block';
  } else {
    successMsg.textContent = text;
    successMsg.style.display = 'block';
  }
}

// Verify email on page load
document.addEventListener('DOMContentLoaded', async () => {
  const token = getTokenFromURL();
  
  if (!token) {
    showMessage('error', 'Invalid verification link. No token provided.');
    return;
  }

  try {
    const res = await fetch('/api/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || 'Verification failed');
    }

    // Store user in localStorage
    localStorage.setItem('user', JSON.stringify(result.user));

    showMessage('success', 'Email verified successfully! Redirecting to dashboard...');

    // Redirect to dashboard after 2 seconds
    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 2000);
  } catch (err) {
    showMessage('error', err.message || 'Verification failed. Please try again or request a new verification link.');
  }
});

