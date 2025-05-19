const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Application = require("../models/Application");
const Job = require("../models/Job");
const User = require("../models/User");

// POST /api/applications/:jobId - student applies to a job
router.post("/:jobId", auth, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ msg: "Only students can apply" });
    }

    const alreadyApplied = await Application.findOne({
      student: req.user.id,
      job: req.params.jobId,
    });

    if (alreadyApplied) {
      return res.status(400).json({ msg: "Already applied to this job" });
    }

    // Check if the job exists
    const job = await Job.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ msg: "Job not found" });
    }

    // Check if application deadline has passed
    if (job.deadline && new Date(job.deadline) < new Date()) {
      return res.status(400).json({ msg: "Application deadline has passed" });
    }

    // Get student details
    const student = await User.findById(req.user.id);

    // Check if student meets CGPA requirements
    if (job.minCGPA && student.cgpa < job.minCGPA) {
      return res.status(400).json({ msg: "You do not meet the minimum CGPA requirement" });
    }

    // Check if student's branch is eligible
    if (job.branches && job.branches.length > 0) {
      const studentBranch = student.department;
      // Standardize branch name for comparison
      const standardizedBranch = standardizeBranchName(studentBranch);
      
      if (!job.branches.includes(standardizedBranch)) {
        return res.status(400).json({ msg: "Your branch is not eligible for this job" });
      }
    }

    // Create application
    const application = new Application({
      student: req.user.id,
      job: req.params.jobId
    });

    await application.save();
    res.status(201).json({ msg: "Application submitted", application });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Helper function to standardize branch names for comparison
function standardizeBranchName(branch) {
  if (!branch) return 'Not specified';
  
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
  
  // Return the original branch if no match is found
  return branch;
}

// GET /api/applications - Get all applications for the logged-in student
router.get("/", auth, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ msg: "Access denied" });
    }

    const applications = await Application.find({ student: req.user.id })
      .populate("job")
      .sort({ appliedAt: -1 });

    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ✅ GET /api/applications/job/:jobId - officer views applicants
router.get("/job/:jobId", auth, async (req, res) => {
  try {
    if (req.user.role !== "officer") {
      return res.status(403).json({ msg: "Only officers can view applicants" });
    }

    const applications = await Application.find({ job: req.params.jobId })
      .populate("student", "name email resume department rollNumber cgpa profilePicture");

    res.json(applications);
  } catch (err) {
    console.error("Error fetching applicants:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// GET /api/applications/stats - Get dashboard statistics for officers
router.get("/stats", auth, async (req, res) => {
  try {
    if (req.user.role !== "officer") {
      return res.status(403).json({ msg: "Only officers can view these statistics" });
    }

    // Get jobs posted by this officer
    const jobs = await Job.find({ postedBy: req.user.id });
    const jobIds = jobs.map(job => job._id);

    // Get count of all applications for officer's jobs
    const totalApplications = await Application.countDocuments({ job: { $in: jobIds } });
    
    // Get applications grouped by job
    const applicationsByJob = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: "$job", count: { $sum: 1 } } }
    ]);

    // Get applications for each job
    const jobsWithApplications = await Promise.all(jobs.map(async (job) => {
      const applicationsCount = await Application.countDocuments({ job: job._id });
      return {
        _id: job._id,
        title: job.title,
        company: job.company,
        applicationsCount
      };
    }));

    // Get application stats by date (last 7 days)
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const recentApplications = await Application.aggregate([
      { 
        $match: { 
          job: { $in: jobIds },
          appliedAt: { $gte: sevenDaysAgo } 
        } 
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: "%Y-%m-%d", date: "$appliedAt" } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get applications grouped by status
    const statusCounts = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    
    // Convert to object format
    const applicationsByStatus = {};
    statusCounts.forEach(status => {
      applicationsByStatus[status._id] = status.count;
    });

    // Get detailed statistics about offered students
    const offeredStudents = await Application.aggregate([
      { 
        $match: { 
          job: { $in: jobIds },
          status: 'offered'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'student',
          foreignField: '_id',
          as: 'studentDetails'
        }
      },
      {
        $unwind: '$studentDetails'
      },
      {
        $group: {
          _id: '$studentDetails.department',
          count: { $sum: 1 },
          students: {
            $push: {
              name: '$studentDetails.name',
              email: '$studentDetails.email',
              cgpa: '$studentDetails.cgpa'
            }
          }
        }
      }
    ]);

    // Calculate placement percentage
    // Count only students who have applied to at least one job (registered in placement portal)
    const activeStudents = await Application.aggregate([
      { $group: { _id: "$student" } }
    ]);
    
    // Get total number of students in the system
    const totalStudentsCount = await User.countDocuments({ role: 'student' });
    
    // Number of unique students who have applied to jobs
    const registeredStudentCount = activeStudents.length;
    
    // Count unique students with offers (not just applications with offers)
    const studentsWithOffers = await Application.aggregate([
      { $match: { status: 'offered' } },
      { $group: { _id: "$student" } }
    ]);
    
    const offeredStudentCount = studentsWithOffers.length;
    
    // Get the count of applications with offered status
    const offeredApplicationsCount = applicationsByStatus['offered'] || 0;
    
    // Calculate placement percentage using the specified logic
    let placementPercentage = 0;
    if (totalStudentsCount > 0) {
      placementPercentage = ((offeredStudentCount / totalStudentsCount) * 100).toFixed(2);
      placementPercentage = parseFloat(placementPercentage);
    }

    res.json({
      totalJobs: jobs.length,
      totalApplications,
      jobsWithApplications,
      recentApplications,
      applicationsByStatus,
      offeredStudents,
      placementPercentage,
      totalStudents: totalStudentsCount, // Total students in system
      registeredStudentCount, // Students who applied
      offeredStudentCount, // Students who got offers
      offeredApplicationsCount // Applications with offered status
    });
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// GET /api/applications/:id - Get a single application by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate("student", "name email resume department rollNumber cgpa profilePicture");
    
    if (!application) {
      return res.status(404).json({ msg: "Application not found" });
    }

    // Check if user has permission to view this application
    const isStudent = req.user.role === "student";
    const isOfficer = req.user.role === "officer";
    
    if (isStudent && application.student._id.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Access denied" });
    }

    if (isOfficer) {
      // For officers, we should check if they posted the job
      const job = await Job.findById(application.job);
      if (!job || job.postedBy.toString() !== req.user.id) {
        return res.status(403).json({ msg: "Access denied" });
      }
    }

    res.json(application);
  } catch (err) {
    console.error("Error fetching application:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// PATCH /api/applications/:id/status - Update application status (for officer)
router.patch("/:id/status", auth, async (req, res) => {
  try {
    console.log("Received status update request for application:", req.params.id);
    console.log("User role:", req.user.role);
    console.log("Request body:", req.body);
    
    if (req.user.role !== "officer") {
      console.log("Access denied - user is not an officer");
      return res.status(403).json({ msg: "Access denied" });
    }

    const { status } = req.body;
    if (!status) {
      console.log("Status is required but was not provided");
      return res.status(400).json({ msg: "Status is required" });
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      console.log("Application not found:", req.params.id);
      return res.status(404).json({ msg: "Application not found" });
    }
    
    console.log("Found application:", application._id);
    console.log("Current status:", application.status);
    console.log("New status:", status);

    // Define status order for chronological workflow enforcement
    const statusOrder = {
      "applied": 1,
      "shortlisted": 2,
      "interviewed": 3,
      "offered": 4,
      "rejected": 4 // same level as offered, an alternative final state
    };
    
    // Check if trying to move backwards in status workflow
    if (statusOrder[status] < statusOrder[application.status]) {
      console.log(`Cannot change status backward from ${application.status} to ${status}`);
      return res.status(400).json({ 
        msg: `Cannot change status from '${application.status}' to '${status}'. Status can only move forward in the workflow.` 
      });
    }

    // Prevent changing from "offered" to "rejected"
    if (application.status === "offered" && status === "rejected") {
      console.log("Cannot change status from offered to rejected");
      return res.status(400).json({ msg: "Cannot change status from 'Offered' to 'Rejected'" });
    }

    // Update timestamp based on status change
    const statusTimestampField = {
      'shortlisted': 'shortlistedAt',
      'interviewed': 'interviewedAt',
      'offered': 'offeredAt',
      'rejected': 'rejectedAt'
    }[status];

    if (statusTimestampField) {
      console.log(`Updating timestamp field: ${statusTimestampField}`);
      application[statusTimestampField] = Date.now();
    }

    application.status = status;
    await application.save();
    console.log("Application status updated successfully");

    res.json({ msg: "Application status updated", application });
  } catch (err) {
    console.error("Error updating application status:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// POST /api/applications/:id/notes - Add notes to an application (for officer)
router.post("/:id/notes", auth, async (req, res) => {
  try {
    if (req.user.role !== "officer") {
      return res.status(403).json({ msg: "Access denied" });
    }

    const { notes } = req.body;
    if (!notes) {
      return res.status(400).json({ msg: "Notes are required" });
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ msg: "Application not found" });
    }

    application.notes = notes;
    await application.save();

    res.json({ msg: "Application notes updated", application });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
