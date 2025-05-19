// Load dashboard data when page loads
document.addEventListener("DOMContentLoaded", loadDashboard);

function loadDashboard() {
  const token = localStorage.getItem("token");
  if (!token) {
    return; // This is handled by script.js now
  }

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const role = payload.role;
    const userId = payload.id;
    
    // Initialize with role while we wait for the full user data
    document.getElementById("userRole").innerText = role.toUpperCase();

    // Load user data for the header
    fetch("http://localhost:5000/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(userData => {
        // Update name in the header
        document.getElementById("userName").innerText = userData.name || "User";
      })
      .catch(err => {
        console.error("Error loading user data:", err);
        // Set a fallback name if the API call fails
        document.getElementById("userName").innerText = payload.name || "User";
      });

    if (role === "officer") {
      document.getElementById("officerDashboard").style.display = "block";
      loadOfficerDashboard(token, userId);
    } else if (role === "student") {
      document.getElementById("studentDashboard").style.display = "block";
      loadStudentDashboard(token);
    }
  } catch (error) {
    console.error("Error parsing token:", error);
    logout();
  }
}

async function loadOfficerDashboard(token, officerId) {
  try {
    // Fetch dashboard statistics
    const statsResponse = await fetch("http://localhost:5000/api/applications/stats", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (!statsResponse.ok) {
      throw new Error("Failed to fetch dashboard stats");
    }
    
    const stats = await statsResponse.json();
    
    // Render dashboard statistics
    renderDashboardStats(stats);
    
    // Render applications chart
    if (stats.recentApplications && stats.recentApplications.length > 0) {
      renderApplicationsChart(stats.recentApplications);
    } else {
      document.getElementById("applicationsChart").innerHTML = 
        '<div class="card"><p class="card-description">No application data available for the last 7 days.</p></div>';
    }
    
    // Render top jobs by applications
    if (stats.jobsWithApplications && stats.jobsWithApplications.length > 0) {
      renderTopJobs(stats.jobsWithApplications);
    } else {
      document.getElementById("topJobs").innerHTML = 
        '<div class="card"><p class="card-description">No job application data available.</p></div>';
    }
  } catch (error) {
    console.error("Error loading officer dashboard:", error);
    document.getElementById("dashboardStats").innerHTML = 
      `<div class="card"><p class="card-description">Error loading dashboard data: ${error.message}</p></div>`;
    document.getElementById("applicationsChart").innerHTML = 
      '<div class="card"><p class="card-description">Error loading chart data.</p></div>';
    document.getElementById("topJobs").innerHTML = 
      '<div class="card"><p class="card-description">Error loading job application data.</p></div>';
  }
}

function renderDashboardStats(stats) {
  const statsContainer = document.getElementById("dashboardStats");
  
  // Get the values for new statistics
  const totalStudents = stats.totalStudents || 0;
  let offeredCount = stats.offeredStudentCount || 0;
  
  // Fallback to applications by status if offeredStudentCount isn't available
  if (!offeredCount && stats.applicationsByStatus && stats.applicationsByStatus['offered']) {
    offeredCount = stats.applicationsByStatus['offered'];
  }
  
  // Calculate placement rate using the specified logic
  let placementRate = stats.placementPercentage;
  
  if (!placementRate && totalStudents > 0) {
    placementRate = ((offeredCount / totalStudents) * 100).toFixed(2);
  }
  
  statsContainer.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Total Jobs</h3>
        <i class="fas fa-briefcase card-icon"></i>
      </div>
      <div class="card-value">${stats.totalJobs}</div>
      <p class="card-description">Jobs posted by you</p>
    </div>
    
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Total Applications</h3>
        <i class="fas fa-file-alt card-icon"></i>
      </div>
      <div class="card-value">${stats.totalApplications}</div>
      <p class="card-description">Applications received for your jobs</p>
    </div>
    
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Students Offered</h3>
        <i class="fas fa-user-check card-icon"></i>
      </div>
      <div class="card-value">${offeredCount}</div>
      <p class="card-description">Students with job offers</p>
    </div>
    
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Placement Rate</h3>
        <i class="fas fa-chart-line card-icon"></i>
      </div>
      <div class="card-value">${placementRate || 0}%</div>
      <p class="card-description">Percentage of students placed</p>
    </div>
  `;
  
  // Add the offers by department table if there are any offered students
  if (stats.offeredStudents && stats.offeredStudents.length > 0) {
    const deptTableDiv = document.createElement('div');
    deptTableDiv.className = 'card';
    deptTableDiv.style.marginTop = '20px';
    deptTableDiv.innerHTML = `
      <div class="card-header" style="display: flex; align-items: center; background-color: #f7f7f7; padding: 15px; border-bottom: 1px solid #eaeaea;">
        <i class="fas fa-graduation-cap card-icon" style="margin-right: 10px; color: var(--primary-color); font-size: 1.5rem;"></i>
        <h3 class="card-title" style="margin: 0;">Offers by Department</h3>
      </div>
      <div class="card-body" style="padding: 0;">
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background-color: #f1f1f1;">
                <th style="padding: 12px 15px; font-weight: 600; border-bottom: 2px solid #ddd;">Department</th>
                <th style="padding: 12px 15px; font-weight: 600; border-bottom: 2px solid #ddd;">Number of Offers</th>
              </tr>
            </thead>
            <tbody>
              ${stats.offeredStudents.map((dept, index) => `
                <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
                  <td style="padding: 12px 15px; border-bottom: 1px solid #eaeaea;">${dept._id || 'Unspecified'}</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #eaeaea; font-weight: 600; color: var(--primary-color);">
                    <span style="display: flex; align-items: center; gap: 5px;">
                      <i class="fas fa-user-check" style="color: var(--secondary-color);"></i>
                      ${dept.count}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background-color: #f7f7f7;">
                <td style="padding: 12px 15px; font-weight: 600; border-top: 2px solid #ddd;">Total</td>
                <td style="padding: 12px 15px; font-weight: 600; border-top: 2px solid #ddd; color: var(--primary-color);">
                  ${stats.offeredStudents.reduce((total, dept) => total + dept.count, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
    statsContainer.appendChild(deptTableDiv);
  }
}

function renderApplicationsChart(recentApplications) {
  const container = document.getElementById("applicationsChart");
  container.innerHTML = '<canvas id="applicationsCanvas"></canvas>';
  
  const ctx = document.getElementById('applicationsCanvas').getContext('2d');
  
  // Prepare data for chart
  const labels = recentApplications.map(item => item._id);
  const data = recentApplications.map(item => item.count);
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Applications Received',
        data: data,
        backgroundColor: 'rgba(52, 152, 219, 0.7)',
        borderColor: 'rgba(52, 152, 219, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

function renderTopJobs(jobs) {
  // Sort jobs by application count
  const sortedJobs = [...jobs].sort((a, b) => b.applicationsCount - a.applicationsCount);
  
  // Get top 3 jobs (or all if less than 3)
  const topJobs = sortedJobs.slice(0, 3);
  
  const container = document.getElementById("topJobs");
  
  if (topJobs.length === 0) {
    container.innerHTML = '<div class="card"><p class="card-description">No job application data available.</p></div>';
    return;
  }
  
  container.innerHTML = topJobs.map(job => `
    <div class="job-card">
      <h3 class="job-title">${job.title}</h3>
      <p class="job-company">${job.company}</p>
      <div class="job-detail">
        <i class="fas fa-users"></i>
        <span><strong>${job.applicationsCount}</strong> applications received</span>
      </div>
      <div class="job-actions">
        <a href="jobs-posted.html" class="btn btn-primary">View Details</a>
      </div>
    </div>
  `).join('');
}

// Define the standardizeBranchName function for consistent branch naming
function standardizeBranchName(branch) {
  if (!branch) return '';
  
  // Convert branch to lowercase for case-insensitive comparison
  const lowerBranch = branch.toLowerCase();
  
  // Map common variations to standardized names
  if (lowerBranch.includes('computer') || lowerBranch.includes('cse') || lowerBranch === 'cs') {
    return 'Computer Science Engineering';
  } else if (lowerBranch.includes('information') || lowerBranch.includes('ise') || lowerBranch === 'is') {
    return 'Information Science';
  } else if (lowerBranch.includes('electronic') && lowerBranch.includes('communication') || lowerBranch.includes('ece')) {
    return 'Electronics and Communication';
  } else if (lowerBranch.includes('ai') || lowerBranch.includes('ml') || lowerBranch.includes('artificial')) {
    return 'AIML';
  } else if (lowerBranch.includes('electric') && lowerBranch.includes('electronic') || lowerBranch.includes('eee')) {
    return 'Electrical and Electronics';
  } else if (lowerBranch.includes('civil')) {
    return 'Civil';
  } else if (lowerBranch.includes('mech')) {
    return 'Mechanical';
  } else if (lowerBranch.includes('chem')) {
    return 'Chemical';
  }
  
  // If no match found, return empty string
  return '';
}

function loadStudentDashboard(token) {
  // Load student profile data
  fetch("http://localhost:5000/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
    .then(res => res.json())
    .then(userData => {
      // Populate profile form fields
      document.getElementById("profileName").value = userData.name || "";
      document.getElementById("profileEmail").value = userData.email || "";
      
      // Set branch dropdown value if department exists
      const branchSelect = document.getElementById("profileBranch");
      if (userData.department) {
        // Standardize the department name
        const standardizedBranch = standardizeBranchName(userData.department);
        
        if (standardizedBranch) {
          // Find the standardized branch option
          for (let i = 0; i < branchSelect.options.length; i++) {
            if (branchSelect.options[i].value === standardizedBranch) {
              branchSelect.selectedIndex = i;
              break;
            }
          }
        } else {
          // If no standardized match, just show the original value in a new option
          branchSelect.innerHTML += `<option value="${userData.department}">${userData.department}</option>`;
          branchSelect.value = userData.department;
        }
      }
      
      document.getElementById("profileRollNumber").value = userData.rollNumber || "";
      document.getElementById("profileCGPA").value = userData.cgpa || "";
      document.getElementById("profilePhone").value = userData.phone || "";
      
      // Update resume status - Handle different resume data structures
      if (userData.resume) {
        // If resume is an object with path property
        if (typeof userData.resume === 'object' && userData.resume.path) {
          document.getElementById("currentResume").innerHTML = `
            <a href="http://localhost:5000${userData.resume.path}" target="_blank">
              ${userData.resume.filename || "Resume.pdf"}
            </a> (Uploaded on ${new Date(userData.resume.uploadDate || Date.now()).toLocaleDateString()})`;
        } 
        // If resume is just a string path
        else if (typeof userData.resume === 'string') {
          document.getElementById("currentResume").innerHTML = `
            <a href="http://localhost:5000${userData.resume}" target="_blank">
              Resume.pdf
            </a> (Uploaded previously)`;
        } else {
          document.getElementById("currentResume").innerHTML = "No resume uploaded";
        }
      } else {
        document.getElementById("currentResume").innerHTML = "No resume uploaded";
      }
    })
    .catch(err => {
      console.error("Error loading profile data:", err);
    });

  // Handle profile form submission
  const profileForm = document.getElementById("profileForm");
  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      // Get selected branch value
      const branchValue = document.getElementById("profileBranch").value;
      // Try to standardize the branch name
      const standardizedBranch = standardizeBranchName(branchValue) || branchValue;
      
      const profileData = {
        name: document.getElementById("profileName").value,
        department: standardizedBranch,
        rollNumber: document.getElementById("profileRollNumber").value,
        cgpa: parseFloat(document.getElementById("profileCGPA").value),
        phone: document.getElementById("profilePhone").value
      };
      
      const profileMsg = document.getElementById("profileMsg");
      profileMsg.innerText = "Updating profile...";
      
      try {
        const res = await fetch("http://localhost:5000/api/auth/update-profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(profileData)
        });
        
        const data = await res.json();
        profileMsg.innerText = data.msg || "Profile updated successfully!";
        
        // Update the username in the header if name was changed
        if (profileData.name) {
          document.getElementById("userName").innerText = profileData.name;
        }
      } catch (error) {
        console.error("Error updating profile:", error);
        profileMsg.innerText = "Failed to update profile. Please try again.";
        profileMsg.style.color = "var(--danger-color)";
      }
    });
  }

  // Handle file input change for resume
  const fileInput = document.getElementById("resumeFile");
  if (fileInput) {
    fileInput.addEventListener("change", function() {
      const fileName = this.files[0]?.name || "No file chosen";
      document.getElementById("fileName").textContent = fileName;
    });
  }

  // Handle resume upload
  const resumeForm = document.getElementById("resumeForm");
  if (resumeForm) {
    resumeForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fileInput = document.getElementById("resumeFile");
      if (!fileInput.files || fileInput.files.length === 0) {
        document.getElementById("resumeMsg").innerText = "Please select a file to upload.";
        document.getElementById("resumeMsg").style.color = "var(--danger-color)";
        return;
      }
      
      // Check file size on client side (max 5MB)
      const fileSize = fileInput.files[0].size;
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (fileSize > maxSize) {
        document.getElementById("resumeMsg").innerText = "File is too large. Maximum allowed size is 5MB.";
        document.getElementById("resumeMsg").style.color = "var(--danger-color)";
        return;
      }

      const formData = new FormData();
      formData.append("resume", fileInput.files[0]);

      document.getElementById("resumeMsg").innerText = "Uploading...";

      try {
        const res = await fetch("http://localhost:5000/api/upload/resume", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.msg || `Error: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        document.getElementById("resumeMsg").innerText = data.msg || "Resume uploaded successfully!";
        document.getElementById("resumeMsg").style.color = "var(--secondary-color)";
        
        // Update the current resume display
        if (data.resume) {
          document.getElementById("currentResume").innerHTML = `
            <a href="http://localhost:5000${data.resume.path}" target="_blank">
              ${data.resume.filename || "Resume.pdf"}
            </a> (Uploaded just now)`;
        }
        
        document.getElementById("fileName").textContent = "";
        resumeForm.reset();
      } catch (error) {
        console.error("Error uploading resume:", error);
        let errorMessage = "Upload failed. ";
        
        if (error.message.includes("too large")) {
          errorMessage += "File is too large. Maximum allowed size is 5MB.";
        } else {
          errorMessage += "Please try again.";
        }
        
        document.getElementById("resumeMsg").innerText = errorMessage;
        document.getElementById("resumeMsg").style.color = "var(--danger-color)";
      }
    });
  }

  // Load available jobs
  // First fetch student's applications, then fetch and filter jobs
  fetch("http://localhost:5000/api/applications", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
    .then(res => res.json())
    .then(applications => {
      // Get the IDs of jobs the student has already applied to
      const appliedJobIds = applications.map(app => app.job._id);
      
      // Update the applications count badge
      document.getElementById("applicationsCount").innerText = applications.length;
      
      // Now fetch all jobs
      return fetch("http://localhost:5000/api/jobs")
        .then(res => res.json())
        .then(jobs => {
          // Filter out jobs that the student has already applied to
          const availableJobs = jobs.filter(job => !appliedJobIds.includes(job._id));
          
          // Update the opportunities count badge
          document.getElementById("opportunitiesCount").innerText = availableJobs.length;
          
          const jobList = document.getElementById("jobList");
          
          if (availableJobs.length === 0) {
            jobList.innerHTML = '<div class="card"><p class="card-description">No new job opportunities available at this time. Check "My Applications" to see your existing applications.</p></div>';
            return;
          }
          
          jobList.innerHTML = availableJobs.map(job => `
            <div class="job-card">
              <h3 class="job-title">${job.title}</h3>
              <p class="job-company">${job.company}</p>
              <div class="job-detail">
                <i class="fas fa-money-bill-wave"></i>
                <span>${job.salary}</span>
              </div>
              <div class="job-detail">
                <i class="fas fa-briefcase"></i>
                <span>${job.description.substring(0, 100)}${job.description.length > 100 ? '...' : ''}</span>
              </div>
              <div class="job-detail">
                <i class="fas fa-award"></i>
                <span>Min CGPA: ${job.minCGPA || 'Not specified'}</span>
              </div>
              ${job.branches && job.branches.length ? `
              <div class="job-detail">
                <i class="fas fa-graduation-cap"></i>
                <span>Eligible Branches: ${job.branches.join(', ')}</span>
              </div>
              ` : ''}
              <div class="job-actions">
                <button onclick="applyToJob('${job._id}', this)" class="btn btn-primary">Apply</button>
                <span class="apply-msg"></span>
              </div>
            </div>
          `).join("");
        });
    })
    .catch(err => {
      console.error("Error loading jobs:", err);
      document.getElementById("jobList").innerHTML = 
        '<div class="card"><p class="card-description">Error loading available jobs. Please try again later.</p></div>';
    });
}

function applyToJob(jobId, btn) {
  const token = localStorage.getItem("token");

  // Disable button to prevent multiple applications
  btn.disabled = true;
  btn.innerText = "Applying...";
  
  const msgSpan = btn.nextElementSibling;
  msgSpan.innerText = "";

  fetch(`http://localhost:5000/api/applications/${jobId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  })
    .then(res => {
      // Check if the response is ok
      if (res.ok) {
        return res.json().then(data => {
          msgSpan.innerText = data.msg || "Applied";
          msgSpan.style.color = "var(--secondary-color)";
          
          // Update button to show applied state
          btn.innerText = "Applied";
          btn.classList.remove("btn-primary");
          btn.classList.add("btn-secondary");
        });
      } else {
        // Handle error responses
        return res.json().then(errorData => {
          // Check if it's an eligibility issue
          if (errorData.msg && (
              errorData.msg.includes("CGPA requirement") || 
              errorData.msg.includes("branch is not eligible") ||
              errorData.msg.includes("deadline") ||
              errorData.msg.includes("Already applied")
            )) {
            msgSpan.innerText = errorData.msg;
            msgSpan.style.color = "var(--danger-color)";
            
            // Update button to show not eligible state
            btn.innerText = "Not Eligible";
            btn.classList.remove("btn-primary");
            btn.classList.add("btn-danger"); // Use the danger color class
            return;
          }
          
          // For other errors
          throw new Error(errorData.msg || "Error applying");
        });
      }
    })
    .catch(err => {
      console.error("Error applying for job:", err);
      msgSpan.innerText = err.message || "Error applying";
      msgSpan.style.color = "var(--danger-color)";
      
      // Re-enable button on error
      btn.disabled = false;
      btn.innerText = "Apply";
    });
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

// Load dashboard when page loads
document.addEventListener("DOMContentLoaded", loadDashboard);
