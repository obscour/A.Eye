// auth.js — handles login using secure API routes

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

    // Login success
    showMessage("success", "Login successful! Redirecting...");
    
    // Store user in localStorage
    localStorage.setItem("user", JSON.stringify(result.user));
    
    // Also store in appropriate key based on role
    if (result.user.role === "admin") {
      localStorage.setItem("admin", JSON.stringify(result.user));
    } else if (result.user.role === "teacher") {
      localStorage.setItem("teacher", JSON.stringify(result.user));
    } else if (result.user.role === "mis") {
      localStorage.setItem("mis", JSON.stringify(result.user));
    }

    // Log login activity for all user types
    if (window.auditLog && result.user) {
      const roleLabel = result.user.role === 'mis' ? 'MIS' : 
                       result.user.role === 'teacher' ? 'Teacher' : 
                       result.user.role === 'admin' ? 'Admin' : 'Student';
      const userId = result.user.id || result.user.uuid;
      await window.auditLog.logActivity('login', `${roleLabel} ${result.user.username} logged in`, userId);
    }

    // Redirect based on role
    setTimeout(() => {
      if (result.user.role === "admin") {
        window.location.href = "admin-dashboard.html";
      } else if (result.user.role === "teacher") {
        window.location.href = "teacher-dashboard.html";
      } else if (result.user.role === "mis") {
        window.location.href = "mis-dashboard.html";
      } else {
        window.location.href = "student-dashboard.html";
      }
    }, 1000);
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
      if (user) {
        // Small delay to prevent redirect loops
        setTimeout(() => {
          if (user.role === "admin") {
            window.location.href = "admin-dashboard.html";
          } else if (user.role === "teacher") {
            window.location.href = "teacher-dashboard.html";
          } else if (user.role === "mis") {
            window.location.href = "mis-dashboard.html";
          } else {
            window.location.href = "student-dashboard.html";
          }
        }, 100);
      }
    }
  } catch (err) {
    // Ignore parse errors, user might not be logged in
    console.error("Error checking user session:", err);
  }
});
