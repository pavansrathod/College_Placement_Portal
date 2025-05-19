// models/Job.js
const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  title: String,
  description: String,
  company: String,
  salary: String,
  branches: [String], // ✅ allows multiple branches
  location: String,
  deadline: Date,
  minCGPA: {
    type: Number,
    default: 0
  },
  salaryValue: {
    type: Number, // Storing a numeric value for sorting/filtering
    default: 0
  },

  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Job", jobSchema);
