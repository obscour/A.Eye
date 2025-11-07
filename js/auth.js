// auth.js — handles login & registration using secure API routes

// Toggle between login and register forms
function toggleForms() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const formTitle = document.getElementById("formTitle");

  if (loginForm.style.display === "none") {
    loginForm.style.display = "block";
    registerForm.style.display = "none";
    formTitle.textContent = "Login";
  } else {
    loginForm.style.display = "none";
    registerForm.style.display = "block";
    formTitle.textContent = "Register";
  }

  hideMessages();
}

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

    // Login success
    showMessage("success", "Login successful! Redirecting...");
    
    // Store user in localStorage
    localStorage.setItem("user", JSON.stringify(result.user));
    
    // Also store in 'teacher' key if role is teacher (for teacher-dashboard compatibility)
    if (result.user.role === "teacher") {
      localStorage.setItem("teacher", JSON.stringify(result.user));
    }

    // Redirect based on role
    setTimeout(() => {
      if (result.user.role === "teacher") {
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
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMessages();

  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const username = document.getElementById("registerUsername").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();
  const accountType = document.querySelector('input[name="accountType"]:checked').value;

  if (!firstName || !lastName || !username || !email || !password || !confirmPassword) {
    showMessage("error", "Please fill in all fields.");
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
        firstName,
        lastName,
        username,
        email,
        password,
        role: accountType,
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Registration failed");

    showMessage("success", "Registration successful! Redirecting to login...");
    setTimeout(() => {
      toggleForms();
    }, 1500);
  } catch (err) {
    showMessage("error", err.message);
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
      if (user && user.role) {
        // Small delay to prevent redirect loops
        setTimeout(() => {
          if (user.role === "teacher") {
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
