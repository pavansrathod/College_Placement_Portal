const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Message = require('../models/Message');
const auth = require("../middleware/auth");

// Cache mechanism for stats to avoid frequent DB queries
let statsCache = {
    data: null,
    timestamp: 0
};

// Connected clients for SSE
const clients = [];

// Function to fetch latest stats from the database
async function fetchLatestStats() {
    try {
        const [studentCount, jobsCount, applicationsCount, offersCount] = await Promise.all([
            User.countDocuments({ role: 'student' }),
            Job.countDocuments(),
            Application.countDocuments(),
            Application.countDocuments({ status: 'offered' })
        ]);

        // Prepare stats data
        const statsData = {
            students: studentCount,
            jobs: jobsCount,
            applications: applicationsCount,
            offers: offersCount
        };

        // Update cache
        statsCache = {
            data: statsData,
            timestamp: Date.now()
        };

        return statsData;
    } catch (error) {
        console.error('Error fetching latest stats:', error);
        // Return cache or default values
        return statsCache.data || {
            students: 3000,
            jobs: 150,
            applications: 470,
            offers: 300
        };
    }
}

// Function to send updates to all connected clients
function sendUpdateToAllClients(data) {
    clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify({
            success: true,
            data: data,
            timestamp: Date.now()
        })}\n\n`);
    });
}

// Start periodic updates for SSE clients
let updateInterval;
function startPeriodicUpdates() {
    // Clear existing interval if any
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    // Only start interval if we have clients
    if (clients.length > 0) {
        updateInterval = setInterval(async () => {
            const data = await fetchLatestStats();
            sendUpdateToAllClients(data);
        }, 2000); // Update every 2 seconds
    }
}

// Route to get stats for homepage (standard REST API)
router.get('/stats', async (req, res) => {
    const currentTime = Date.now();
    // If cache is less than 10 seconds old, return cached data
    if (statsCache.data && currentTime - statsCache.timestamp < 10000) {
        return res.json({
            success: true,
            data: statsCache.data,
            cached: true
        });
    }

    try {
        const statsData = await fetchLatestStats();

        // Send response
        res.json({
            success: true,
            data: statsData,
            cached: false
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        // If cache exists but expired, use it as fallback during errors
        if (statsCache.data) {
            return res.json({
                success: true,
                data: statsCache.data,
                cached: true,
                fallback: true
            });
        }

        // Send error response with default values if no cache
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching statistics from database',
            data: {
                students: 3000,
                jobs: 150,
                applications: 470,
                offers: 300
            }
        });
    }
});

// SSE endpoint for real-time stats updates
router.get('/stats/live', (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Add this client to the connected clients list
    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    clients.push(newClient);
    console.log(`Client ${clientId} connected for live stats, total clients: ${clients.length}`);

    // Start periodic updates if this is the first client
    if (clients.length === 1) {
        startPeriodicUpdates();
    }

    // Send initial data immediately
    if (statsCache.data) {
        res.write(`data: ${JSON.stringify({
            success: true,
            data: statsCache.data,
            timestamp: Date.now()
        })}\n\n`);
    } else {
        // Fetch and send initial data if no cache
        fetchLatestStats().then(data => {
            res.write(`data: ${JSON.stringify({
                success: true,
                data,
                timestamp: Date.now()
            })}\n\n`);
        });
    }

    // When client disconnects, remove from clients list
    req.on('close', () => {
        const index = clients.findIndex(client => client.id === clientId);
        if (index !== -1) {
            clients.splice(index, 1);
            console.log(`Client ${clientId} disconnected, remaining clients: ${clients.length}`);
        }

        // If no more clients, stop the interval
        if (clients.length === 0 && updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
            console.log('All clients disconnected, stopping updates');
        }
    });
});

// Setup database watchers to trigger real-time updates
function setupDatabaseWatchers() {
    // These would be database change streams or event listeners in a real application
    // For MongoDB you could use Change Streams if using replica sets
    
    // For this example, we'll simulate DB changes with periodic polling
    // But in a production app, you would use DB-specific real-time features
    console.log('Database watchers initialized for real-time updates');
}

// Initialize watchers
setupDatabaseWatchers();

// Get all messages (for debugging)
router.get('/messages', async (req, res) => {
    try {
        const messages = await Message.find().sort({ createdAt: -1 });
        console.log('Found messages:', messages.length);
        res.json({
            success: true,
            count: messages.length,
            messages
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching messages'
        });
    }
});

// Contact form submission endpoint
router.post('/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        console.log('Received contact form submission:', { name, email, subject });

        // Validate required fields
        if (!name || !email || !subject || !message) {
            console.log('Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Create new message
        const newMessage = new Message({
            name,
            email,
            subject,
            message
        });

        console.log('Attempting to save message to database...');

        // Save message to database
        await newMessage.save();

        console.log('Message saved successfully:', newMessage._id);

        // Send success response
        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: {
                id: newMessage._id,
                name: newMessage.name,
                email: newMessage.email,
                subject: newMessage.subject,
                createdAt: newMessage.createdAt
            }
        });
    } catch (error) {
        console.error('Error saving message:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending message. Please try again later.'
        });
    }
});

// Public endpoint to fetch placement statistics for the homepage
router.get("/public/stats", async (req, res) => {
  try {
    // Get all jobs
    const jobs = await Job.find();
    const jobIds = jobs.map(job => job._id);

    // Get count of all applications
    const totalApplications = await Application.countDocuments({ job: { $in: jobIds } });
    
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
          count: { $sum: 1 }
        }
      }
    ]);

    // Count unique students who have applied to at least one job
    const activeStudents = await Application.aggregate([
      { $group: { _id: "$student" } }
    ]);
    
    // Get total number of students in the system
    const totalStudentsCount = await User.countDocuments({ role: 'student' });
    
    // Number of unique students who have applied to jobs
    const registeredStudentCount = activeStudents.length;
    
    // Count unique students with offers
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
      applicationsByStatus,
      offeredStudents,
      placementPercentage,
      totalStudents: totalStudentsCount,
      registeredStudentCount,
      offeredStudentCount
    });
  } catch (err) {
    console.error("Error fetching public stats:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router; 