// server/server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const authRoutes = require("./routes/auth");
const apiRoutes = require("./routes/api");

dotenv.config();
const app = express();

// Middleware
app.use(cors({
  origin: ['http://127.0.0.1:5502', 'http://localhost:5502'], // Add your client origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Increase JSON body parser limit
app.use(express.json({ limit: '100mb' }));
// Increase URL-encoded body parser limit
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Created uploads directory");
}

// Static file serving
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
console.log("✅ Static file serving for uploads configured at", path.join(__dirname, "uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);
// Add this in server.js (after other routes)
const jobRoutes = require("./routes/job");
const applicationRoutes = require("./routes/application");
const uploadRoutes = require("./routes/upload");
console.log("✅ jobRoutes loaded");
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/upload", uploadRoutes);

// Test
app.get("/", (req, res) => {
  res.send("College Placement Portal Backend is running.");
});

// DB + Server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch(err => console.error("❌ MongoDB connection failed:", err));
