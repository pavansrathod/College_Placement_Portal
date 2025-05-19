// client/script.js

const baseURL = "http://localhost:5000/api/auth";

// ✅ PING TEST
function pingServer() {
  fetch("http://localhost:5000/")
    .then(res => res.text())
    .then(data => alert(data))
    .catch(err => alert("Server Error!"));
}

// ✅ REGISTER
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;

    const res = await fetch(`${baseURL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });

    const data = await res.json();
    document.getElementById("registerMsg").innerText = data.msg || "Registration failed";
  });
}

// ✅ LOGIN
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    const res = await fetch(`${baseURL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("token", data.token);
      // 🔁 Redirect to dashboard after login
      window.location.href = "dashboard.html";
    } else {
      document.getElementById("loginMsg").innerText = data.msg || "Login failed";
    }
  });
}

// Common JavaScript functionality for all pages

// Check if user is logged in on page load
document.addEventListener("DOMContentLoaded", function() {
  checkLoginStatus();
  updateNavbar();
});

// Check if user is logged in and redirect if needed
function checkLoginStatus() {
  const token = localStorage.getItem("token");
  
  // If on login or register page, redirect to dashboard if logged in
  if ((window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) && token) {
    try {
      // Verify token validity by checking expiration
      const payload = JSON.parse(atob(token.split(".")[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (payload.exp && payload.exp > currentTime) {
        // Valid token, redirect to dashboard
        window.location.href = "dashboard.html";
        return;
      } else {
        // Expired token
        localStorage.removeItem("token");
      }
    } catch (e) {
      // Invalid token format
      localStorage.removeItem("token");
    }
  }
  
  // If on protected page and not logged in, redirect to login
  if (!token && !window.location.pathname.includes('login.html') && 
      !window.location.pathname.includes('register.html') && 
      !window.location.pathname.includes('index.html')) {
    alert("You must log in first.");
    window.location.href = "login.html";
    return;
  }
}

// Update navbar with user information
function updateNavbar() {
  const token = localStorage.getItem("token");
  if (!token) return;
  
  try {
    // Parse user data from token
    const payload = JSON.parse(atob(token.split(".")[1]));
    
    // Find navbar user elements
    const userNameElements = document.querySelectorAll('.user-name');
    const userRoleElements = document.querySelectorAll('.user-role');
    
    if (userNameElements.length > 0 && payload.name) {
      userNameElements.forEach(el => el.textContent = payload.name);
    }
    
    if (userRoleElements.length > 0 && payload.role) {
      userRoleElements.forEach(el => el.textContent = payload.role.toUpperCase());
    }
    
    // Fetch fresh user data from API for more accurate information
    fetch("http://localhost:5000/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(userData => {
        // Update user name with fresh data
        if (userNameElements.length > 0 && userData.name) {
          userNameElements.forEach(el => el.textContent = userData.name);
        }
      })
      .catch(err => {
        console.error("Error fetching user data for navbar:", err);
      });
  } catch (error) {
    console.error("Error updating navbar:", error);
  }
}

// Logout function
function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}
