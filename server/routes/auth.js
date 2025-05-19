// server/routes/auth.js
const express = require("express");
const router = express.Router();
const { register, login, checkAuth } = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

router.post("/register", register);
router.post("/login", login);
router.get("/check", authMiddleware, checkAuth);

// GET /api/auth/me - Get the logged in user
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// PUT /api/auth/update-profile - Update user profile
router.put("/update-profile", authMiddleware, async (req, res) => {
  try {
    const { name, department, rollNumber, cgpa, phone } = req.body;
    
    // Find user and update fields
    const updateFields = {};
    if (name) updateFields.name = name;
    if (department) updateFields.department = department;
    if (rollNumber) updateFields.rollNumber = rollNumber;
    if (cgpa !== undefined) updateFields.cgpa = cgpa;
    if (phone) updateFields.phone = phone;
    
    const user = await User.findByIdAndUpdate(
      req.user.id, 
      { $set: updateFields },
      { new: true }
    ).select("-password");
    
    res.json({ 
      msg: "Profile updated successfully", 
      user
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
