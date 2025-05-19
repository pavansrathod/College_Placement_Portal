const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const fs = require("fs");

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set storage destination for resumes
const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const resumeDir = path.join(uploadDir, "resumes");
    if (!fs.existsSync(resumeDir)) {
      fs.mkdirSync(resumeDir, { recursive: true });
    }
    cb(null, resumeDir);
  },
  filename: (req, file, cb) => {
    // Keep extension but sanitize and make unique filename
    const fileExt = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExt).replace(/[^a-zA-Z0-9]/g, "_");
    const uniqueName = `${req.user.id}_${baseName}_${Date.now()}${fileExt}`;
    cb(null, uniqueName);
  }
});

// Filter for pdf files
const resumeFileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

// Setup upload middleware
const uploadResume = multer({ 
  storage: resumeStorage,
  fileFilter: resumeFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// POST /api/upload/resume
router.post("/resume", auth, uploadResume.single("resume"), async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ msg: "Only students can upload resumes" });
    }

    if (!req.file) {
      return res.status(400).json({ msg: "No file uploaded" });
    }

    const filePath = `/uploads/resumes/${req.file.filename}`;
    
    const user = await User.findById(req.user.id);
    
    // Save resume metadata
    user.resume = {
      filename: req.file.originalname,
      path: filePath,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadDate: Date.now()
    };
    
    await user.save();

    res.json({ 
      msg: "Resume uploaded successfully", 
      resume: user.resume 
    });
  } catch (err) {
    console.error("Error uploading resume:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
