// auth.js — handles login & registration using secure API routes

// Toggle between login and register forms
function toggleForms() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  const verificationMessage = document.getElementById("verificationMessage");
  const formTitle = document.getElementById("formTitle");

  if (loginForm.style.display === "none") {
    loginForm.style.display = "block";
    registerForm.style.display = "none";
    forgotPasswordForm.style.display = "none";
    if (verificationMessage) verificationMessage.style.display = "none";
    formTitle.textContent = "Login";
  } else {
    loginForm.style.display = "none";
    registerForm.style.display = "block";
    forgotPasswordForm.style.display = "none";
    if (verificationMessage) verificationMessage.style.display = "none";
    formTitle.textContent = "Register";
  }

  // Reset resend email state
  registeredEmail = null;
  const resendStatus = document.getElementById("resendEmailStatus");
  if (resendStatus) {
    resendStatus.style.display = "none";
    resendStatus.className = "mt-2";
    resendStatus.innerHTML = "";
  }

  hideMessages();
}

// Show Terms & Conditions modal
function showTermsModal() {
  const modal = new bootstrap.Modal(document.getElementById('termsModal'));
  modal.show();
}

// Show Privacy Policy modal
function showPrivacyModal() {
  const modal = new bootstrap.Modal(document.getElementById('privacyModal'));
  modal.show();
}

// Make functions globally available
window.showTermsModal = showTermsModal;
window.showPrivacyModal = showPrivacyModal;

// Hide all alert messages
function hideMessages() {
  document.getElementById("error-message").style.display = "none";
  document.getElementById("success-message").style.display = "none";
}

// Display error or success message
function showMessage(type, text) {
  hideMessages();
  const msg = document.getElementById(`${type}-message`);
  msg.textContent = text;
  msg.style.display = "block";
}


// ===============================
// LOGIN HANDLER
// ===============================
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMessages();

  const identifier = document.getElementById("loginIdentifier").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!identifier || !password) {
    showMessage("error", "Please fill in all fields.");
    return;
  }

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    const result = await res.json();

    if (!res.ok) {
      const errorMsg = result.error || result.message || "Login failed";
      console.error("Login API error:", errorMsg, result);
      throw new Error(errorMsg);
    }

    // Check if email is verified
    if (result.user.email_verified === false) {
      showMessage("error", "Please verify your email before logging in. Check your inbox for the verification link.");
      return;
    }

    // Login success
    showMessage("success", "Login successful! Redirecting...");
    
    // Store user in localStorage
    localStorage.setItem("user", JSON.stringify(result.user));
    
    // Also store in appropriate key based on role
    if (result.user.role === "admin") {
      localStorage.setItem("admin", JSON.stringify(result.user));
    } else if (result.user.role === "teacher") {
      localStorage.setItem("teacher", JSON.stringify(result.user));
    }

    // Redirect based on role
    setTimeout(() => {
      if (result.user.role === "admin") {
        window.location.href = "admin-dashboard.html";
      } else if (result.user.role === "teacher") {
        window.location.href = "teacher-dashboard.html";
      } else {
        window.location.href = "dashboard.html";
      }
    }, 1000);
  } catch (err) {
    showMessage("error", err.message);
  }
});

// ===============================
// REGISTRATION HANDLER
// ===============================
// Enable/disable register button based on checkbox
document.addEventListener("DOMContentLoaded", () => {
  const agreeCheckbox = document.getElementById("agreeToTerms");
  const registerBtn = document.getElementById("registerBtn");
  
  if (agreeCheckbox && registerBtn) {
    agreeCheckbox.addEventListener("change", () => {
      registerBtn.disabled = !agreeCheckbox.checked;
    });
  }
});

// Store registration email for resend functionality
let registeredEmail = null;

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMessages();

  const username = document.getElementById("registerUsername").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();
  const agreeToTerms = document.getElementById("agreeToTerms").checked;

  if (!username || !email || !password || !confirmPassword) {
    showMessage("error", "Please fill in all required fields.");
    return;
  }

  if (!agreeToTerms) {
    showMessage("error", "You must agree to the Terms & Conditions and Privacy Policy to register.");
    return;
  }

  if (password !== confirmPassword) {
    showMessage("error", "Passwords do not match.");
    return;
  }

  try {
    const registerData = {
      username,
      email,
      password,
    };

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerData),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Registration failed");

    // Store email for resend functionality
    registeredEmail = email;

    // Hide form and show verification message
    document.getElementById("registerForm").style.display = "none";
    document.getElementById("verificationMessage").style.display = "block";
    document.getElementById("formTitle").textContent = "Verify Your Email";
    
    // Reset form
    document.getElementById("registerForm").reset();
    document.getElementById("registerBtn").disabled = true;
    
    // Reset resend email status
    const resendStatus = document.getElementById("resendEmailStatus");
    if (resendStatus) {
      resendStatus.style.display = "none";
      resendStatus.className = "mt-2";
      resendStatus.innerHTML = "";
    }
  } catch (err) {
    showMessage("error", err.message);
  }
});

// ===============================
// RESEND VERIFICATION EMAIL HANDLER
// ===============================
async function resendVerificationEmail() {
  if (!registeredEmail) {
    showMessage("error", "No email found. Please register again.");
    return;
  }

  const resendBtn = document.getElementById("resendEmailBtn");
  const resendStatus = document.getElementById("resendEmailStatus");
  
  // Disable button and show loading state
  if (resendBtn) {
    resendBtn.disabled = true;
    resendBtn.textContent = "Sending...";
  }

  // Clear previous status
  if (resendStatus) {
    resendStatus.style.display = "none";
    resendStatus.className = "mt-2";
    resendStatus.innerHTML = "";
  }

  try {
    const res = await fetch("/api/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: 'resend', identifier: registeredEmail }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || "Failed to resend email");
    }

    // Show success message
    if (resendStatus) {
      resendStatus.style.display = "block";
      resendStatus.className = "mt-2 alert alert-success";
      resendStatus.innerHTML = `<small>${result.message || "Verification email sent successfully!"}</small>`;
    }

    // In development, show the link in console (for testing)
    if (result.verificationLink) {
      console.log("Verification link (dev/testing only):", result.verificationLink);
      console.warn("⚠️ In production, this link should be sent via email only!");
    }
  } catch (err) {
    // Show error message
    if (resendStatus) {
      resendStatus.style.display = "block";
      resendStatus.className = "mt-2 alert alert-danger";
      resendStatus.innerHTML = `<small>${err.message || "Failed to resend email"}</small>`;
    }
  } finally {
    // Re-enable button
    if (resendBtn) {
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend Verification Email";
    }
  }
}

// Make function globally available
window.resendVerificationEmail = resendVerificationEmail;

// ===============================
// FORGOT PASSWORD HANDLER
// ===============================
function showForgotPassword() {
  hideMessages();
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('forgotPasswordForm').style.display = 'block';
  document.getElementById('formTitle').textContent = 'Reset Password';
}

function hideForgotPassword() {
  hideMessages();
  document.getElementById('forgotPasswordForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('formTitle').textContent = 'Login';
}

document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessages();

  const identifier = document.getElementById('forgotIdentifier').value.trim();

  if (!identifier) {
    showMessage('error', 'Please enter your email or username.');
    return;
  }

  // Show loading state
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier })
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || 'Failed to send reset link');
    }

    // Always show success message (security: don't reveal if user exists)
    showMessage('success', result.message || 'If an account exists with that email/username, a password reset link has been sent to your email.');
    
    // In development, show the link in console (for testing)
    if (result.resetLink) {
      console.log('Reset link (dev/testing only):', result.resetLink);
      console.warn('⚠️ In production, this link should be sent via email only!');
    }

    // Reset form after a delay
    setTimeout(() => {
      hideForgotPassword();
      document.getElementById('forgotPasswordForm').reset();
    }, 3000);
  } catch (err) {
    showMessage('error', err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

// ===============================
// AUTO-REDIRECT IF LOGGED IN
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user && (user.email_verified !== false)) {
        // Small delay to prevent redirect loops
        setTimeout(() => {
          if (user.role === "admin") {
            window.location.href = "admin-dashboard.html";
          } else if (user.role === "teacher") {
            window.location.href = "teacher-dashboard.html";
          } else {
            window.location.href = "dashboard.html";
          }
        }, 100);
      }
    }
  } catch (err) {
    // Ignore parse errors, user might not be logged in
    console.error("Error checking user session:", err);
  }
});
