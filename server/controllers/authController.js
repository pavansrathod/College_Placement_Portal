// server/controllers/authController.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: "User already exists" });

    // Hash password
    const hashed = await bcrypt.hash(password, 10);
    
    // Create user object with conditional fields based on role
    const userData = { 
      name, 
      email, 
      password: hashed, 
      role 
    };
    
    // Add default values for required fields based on role
    if (role === 'student') {
      userData.rollNumber = req.body.rollNumber || 'TEMP-' + Date.now();
      userData.department = req.body.department || 'Not Specified';
    } else if (role === 'recruiter') {
      userData.company = req.body.company || 'Not Specified';
    }
    
    // Create the new user
    const newUser = await User.create(userData);

    console.log("User registered successfully:", newUser.email);
    res.status(201).json({ msg: "User registered successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ msg: "Server error: " + err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: "Invalid credentials" });

    // Use a fallback secret if JWT_SECRET is not set in environment
    const jwtSecret = process.env.JWT_SECRET || "fallback_secret_please_set_env_var";
    
    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      jwtSecret,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Check if user is authenticated
exports.checkAuth = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        authenticated: false, 
        msg: "No token provided" 
      });
    }
    
    // Use a fallback secret if JWT_SECRET is not set in environment
    const jwtSecret = process.env.JWT_SECRET || "fallback_secret_please_set_env_var";
    
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.id).select("-password");
    
    if (!user) {
      return res.status(404).json({ 
        authenticated: false, 
        msg: "User not found" 
      });
    }
    
    res.json({ 
      authenticated: true, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error("Auth check error:", err);
    res.status(401).json({ 
      authenticated: false, 
      msg: "Invalid or expired token" 
    });
  }
};
