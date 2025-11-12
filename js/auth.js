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

// Account type selection
function selectAccountType(type) {
  const studentCard = document.getElementById("studentCard");
  const teacherCard = document.getElementById("teacherCard");
  const studentType = document.getElementById("studentType");
  const teacherType = document.getElementById("teacherType");

  if (type === "student") {
    studentCard.classList.add("selected");
    teacherCard.classList.remove("selected");
    studentType.checked = true;
  } else {
    teacherCard.classList.add("selected");
    studentCard.classList.remove("selected");
    teacherType.checked = true;
  }
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
    if (!result.user.email_verified) {
      showMessage("error", "Please verify your email before logging in. Check your inbox for the verification link.");
      return;
    }

    // Login success
    showMessage("success", "Login successful! Redirecting...");
    
    // Store user in localStorage
    localStorage.setItem("user", JSON.stringify(result.user));
    
    // Also store in 'admin' key if user is admin (for admin-dashboard compatibility)
    if (result.user.role === "admin") {
      localStorage.setItem("admin", JSON.stringify(result.user));
    }

    // Redirect based on role
    setTimeout(() => {
      if (result.user.role === "admin") {
        window.location.href = "admin-dashboard.html";
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

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMessages();

  const username = document.getElementById("registerUsername").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();
  const agreeToTerms = document.getElementById("agreeToTerms").checked;

  if (!username || !email || !password || !confirmPassword) {
    showMessage("error", "Please fill in all fields.");
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
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        email,
        password,
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Registration failed");

    // Hide form and show verification message
    document.getElementById("registerForm").style.display = "none";
    document.getElementById("verificationMessage").style.display = "block";
    document.getElementById("formTitle").textContent = "Verify Your Email";
    
    // Reset form
    document.getElementById("registerForm").reset();
    document.getElementById("registerBtn").disabled = true;
  } catch (err) {
    showMessage("error", err.message);
  }
});

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
    const res = await fetch('/api/request-password-reset', {
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
      if (user && user.email_verified) {
        // Small delay to prevent redirect loops
        setTimeout(() => {
          if (user.role === "admin") {
            window.location.href = "admin-dashboard.html";
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
