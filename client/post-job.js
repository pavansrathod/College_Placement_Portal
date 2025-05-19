document.addEventListener('DOMContentLoaded', function() {
    console.log('Post-job page loaded');
    
    // Set up global functions before auth check
    window.logout = function() {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    };
    
    window.goBack = function() {
        window.location.href = 'dashboard.html';
    };
    
    // DOM elements - will set them up after auth check
    let jobForm, branchChipsContainer;
    let previewTitle, previewCompany, previewDescription, previewBranches;
    let branchSelect, addBranchBtn;
    
    // Branch selection
    let selectedBranches = [];
    
    // Skip auth check in development if needed
    const skipAuth = false; // Set to true for testing without authentication
    
    // First check if we have a token
    const token = localStorage.getItem('token');
    if (!token && !skipAuth) {
        console.log('No authentication token found');
        // Don't redirect immediately to allow console logs to be seen
        setTimeout(() => {
            alert('Please log in to access this page');
            window.location.href = 'login.html';
        }, 500);
        return;
    }
    
    // Always set up the page, even if there might be auth issues
    setupPage();
    
    // Use token directly from JWT payload for authentication
    // We won't try server-side auth check since there seems to be an issue with the endpoint
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.log('Token payload parsed successfully:', payload);
            
            // Set username from token directly
            const userNameElement = document.getElementById('userName');
            if (userNameElement && payload.name) {
                userNameElement.textContent = payload.name;
            }
            
            // Verify role using the token payload directly
            if (payload.role === 'officer') {
                console.log('Token payload confirms officer role');
            } else if (!skipAuth) {
                console.log('Token payload shows non-officer role:', payload.role);
                setTimeout(() => {
                    alert('Only officers can post jobs');
                    window.location.href = 'dashboard.html';
                }, 500);
                return;
            }
        } catch (e) {
            console.error('Error parsing token payload:', e);
            if (!skipAuth) {
                alert('Invalid authentication token. Please log in again.');
                window.location.href = 'login.html';
                return;
            }
        }
    }
    
    // Initialize the page elements and event listeners
    function setupPage() {
        console.log('Setting up page elements');
        
        // Get DOM elements
        jobForm = document.getElementById('jobForm');
        branchChipsContainer = document.getElementById('branchChips');
        previewTitle = document.getElementById('previewTitle');
        previewCompany = document.getElementById('previewCompany');
        previewDescription = document.getElementById('previewDescription');
        previewBranches = document.getElementById('previewBranches');
        branchSelect = document.getElementById('branchSelect');
        addBranchBtn = document.getElementById('addBranchBtn');
        
        // Event listeners
        if (addBranchBtn) {
            addBranchBtn.addEventListener('click', addBranch);
        }
        
        if (jobForm) {
            jobForm.addEventListener('submit', submitJobPost);
            
            // Add live preview updates
            const jobTitle = document.getElementById('jobTitle');
            const jobCompany = document.getElementById('jobCompany');
            const jobDescription = document.getElementById('jobDescription');
            
            if (jobTitle) jobTitle.addEventListener('input', updatePreview);
            if (jobCompany) jobCompany.addEventListener('input', updatePreview);
            if (jobDescription) jobDescription.addEventListener('input', updatePreview);
        }
    }
    
    // Add a branch chip
    function addBranch() {
        let branchValue = branchSelect.value;
        
        if (!branchValue) {
            alert('Please select a branch');
            return;
        }
        
        if (selectedBranches.includes(branchValue)) {
            alert('This branch is already added');
            return;
        }
        
        selectedBranches.push(branchValue);
        
        // Create branch chip
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.innerHTML = `
            ${branchValue}
            <input type="hidden" name="eligible_branches" value="${branchValue}">
            <span class="close" data-branch="${branchValue}">&times;</span>
        `;
        
        branchChipsContainer.appendChild(chip);
        
        // Add event listener for removing the chip
        const closeBtn = chip.querySelector('.close');
        closeBtn.addEventListener('click', function() {
            const branch = this.getAttribute('data-branch');
            selectedBranches = selectedBranches.filter(b => b !== branch);
            branchChipsContainer.removeChild(chip);
            updatePreview();
        });
        
        // Reset inputs
        branchSelect.value = '';
        
        updatePreview();
    }

    // Update preview in real-time
    function updatePreview() {
        if (previewTitle && jobTitle) {
            previewTitle.textContent = jobTitle.value || 'Job Title';
        }
        
        if (previewCompany && jobCompany) {
            previewCompany.textContent = jobCompany.value || 'Company Name';
        }
        
        if (previewDescription && jobDescription) {
            previewDescription.textContent = jobDescription.value || 'Job description will appear here...';
        }
        
        // Update branches preview
        if (previewBranches) {
            previewBranches.innerHTML = '';
            selectedBranches.forEach(branch => {
                const branchChip = document.createElement('div');
                branchChip.className = 'chip';
                branchChip.textContent = branch;
                previewBranches.appendChild(branchChip);
            });
        }
    }
    
    // Submit job post
    function submitJobPost(e) {
        e.preventDefault();
        
        // Validate form
        if (selectedBranches.length === 0) {
            alert('Please add at least one eligible branch');
            return;
        }
        
        const submitBtn = document.querySelector('button[type="submit"]');
        
        // Create job data object
        const jobData = {
            title: document.getElementById('jobTitle').value,
            company: document.getElementById('jobCompany').value,
            description: document.getElementById('jobDescription').value,
            location: document.getElementById('jobLocation').value,
            salary: document.getElementById('jobSalary').value,
            deadline: document.getElementById('jobDeadline').value,
            minCGPA: document.getElementById('jobMinCGPA').value,
            branches: selectedBranches
        };
        
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
        
        fetch('http://localhost:5000/api/jobs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(jobData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Job creation failed');
            }
            return response.json();
        })
        .then(data => {
            alert('Job posted successfully!');
            window.location.href = 'dashboard.html';
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to post job. Please try again.');
            
            // Reset button
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Post Job';
        });
    }
}); 