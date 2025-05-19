// routes/job.js
const express = require("express");
const router = express.Router();
const Job = require("../models/Job");
const authMiddleware = require("../middleware/auth");
console.log("📦 job.js routes loaded");

// Helper function to parse salary to numeric value (LPA)
const parseSalaryToLPA = (salary) => {
  if (!salary) return 0;
  
  const value = parseFloat(salary.replace(/[^0-9.]/g, ''));
  if (!value || isNaN(value)) return 0;
  
  if (salary.toLowerCase().includes('lpa')) {
    return value;
  }
  // Convert monthly to annual (LPA)
  if (salary.toLowerCase().includes('/month') || salary.toLowerCase().includes('per month')) {
    return (value * 12) / 100000;
  }
  return value;
};

// POST /api/jobs - create job (officer only)
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "officer") {
      return res.status(403).json({ msg: "Only officers can post jobs." });
    }

    const { 
      title, 
      description, 
      company, 
      salary, 
      branches, 
      location, 
      deadline,
      minCGPA
    } = req.body;

    // Calculate salary value for filtering/sorting
    const salaryValue = parseSalaryToLPA(salary);

    // Create the job
    const newJob = new Job({
      title,
      description,
      company,
      salary,
      salaryValue,
      branches,
      location,
      deadline: deadline ? new Date(deadline) : undefined,
      minCGPA: minCGPA ? parseFloat(minCGPA) : 0,
      postedBy: req.user.id,
    });

    await newJob.save();
    console.log("✅ Job saved:", newJob);

    res.status(201).json({ 
      msg: "Job posted successfully.", 
      job: newJob 
    });
  } catch (err) {
    console.error("Error saving job:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ✅ GET /api/jobs - fetch all jobs
router.get("/", async (req, res) => {
  try {
    const jobs = await Job.find().populate("postedBy", "name email");
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// GET /api/jobs/:id - fetch a specific job
router.get("/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate("postedBy", "name email");
    
    if (!job) {
      return res.status(404).json({ msg: "Job not found" });
    }
    
    res.json(job);
  } catch (err) {
    console.error("Error fetching job:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Test route
router.get("/test", (req, res) => {
  res.send("✅ Job routes are working!");
});

module.exports = router;
