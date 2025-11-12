// reset-password.js - Handles password reset with token validation

// Hide all messages
function hideMessages() {
  document.getElementById('error-message').style.display = 'none';
  document.getElementById('success-message').style.display = 'none';
  document.getElementById('loading-message').style.display = 'none';
}

// Display error or success message
function showMessage(type, text) {
  hideMessages();
  const msg = document.getElementById(`${type}-message`);
  msg.textContent = text;
  msg.style.display = 'block';
}

// Get token from URL
function getTokenFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

// Validate token on page load
async function validateToken() {
  const token = getTokenFromURL();

  if (!token) {
    showMessage('error', 'Invalid reset link. No token provided.');
    return false;
  }

  document.getElementById('loading-message').style.display = 'block';

  try {
    const res = await fetch('/api/validate-reset-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || 'Invalid or expired reset token');
    }

    // Token is valid, show reset form
    document.getElementById('loading-message').style.display = 'none';
    document.getElementById('resetPasswordForm').style.display = 'block';
    return true;
  } catch (err) {
    showMessage('error', err.message || 'Invalid or expired reset link. Please request a new password reset.');
    return false;
  }
}

// Handle password reset form submission
document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessages();

  const token = getTokenFromURL();
  const newPassword = document.getElementById('newPassword').value.trim();
  const confirmNewPassword = document.getElementById('confirmNewPassword').value.trim();

  if (!newPassword || !confirmNewPassword) {
    showMessage('error', 'Please fill in all fields.');
    return;
  }

  if (newPassword !== confirmNewPassword) {
    showMessage('error', 'Passwords do not match.');
    return;
  }

  if (newPassword.length < 6) {
    showMessage('error', 'Password must be at least 6 characters long.');
    return;
  }

  try {
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || 'Password reset failed');
    }

    showMessage('success', 'Password reset successful! Redirecting to login...');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);
  } catch (err) {
    showMessage('error', err.message);
  }
});

// Validate token when page loads
document.addEventListener('DOMContentLoaded', () => {
  validateToken();
});

