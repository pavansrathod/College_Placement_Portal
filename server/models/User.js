// server/models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'officer', 'recruiter'],
    default: 'student'
  },
  // Student specific fields
  rollNumber: {
    type: String,
    required: function() { return this.role === 'student'; }
  },
  department: {
    type: String,
    required: function() { return this.role === 'student'; }
  },
  cgpa: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  // Recruiter specific fields
  company: {
    type: String,
    required: function() { return this.role === 'recruiter'; }
  },
  // Common optional fields
  phone: {
    type: String
  },
  resume: {
    filename: String,
    path: String,
    mimetype: String,
    size: Number,
    uploadDate: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
});

module.exports = mongoose.model("User", UserSchema);
