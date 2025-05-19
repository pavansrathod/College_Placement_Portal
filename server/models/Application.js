const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ApplicationSchema = new Schema({
  student: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  job: {
    type: Schema.Types.ObjectId,
    ref: "Job",
    required: true
  },
  status: {
    type: String,
    enum: ["applied", "shortlisted", "interviewed", "offered", "rejected"],
    default: "applied"
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  shortlistedAt: {
    type: Date,
    default: null
  },
  interviewedAt: {
    type: Date,
    default: null
  },
  offeredAt: {
    type: Date,
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ""
  }
});

// Compound index to ensure a student can apply only once to a job
ApplicationSchema.index({ student: 1, job: 1 }, { unique: true });

module.exports = Application = mongoose.model("Application", ApplicationSchema);
