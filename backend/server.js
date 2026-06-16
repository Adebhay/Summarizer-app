// server.js - Complete backend with all endpoints

const express = require('express');
const cors = require('cors');
const { generateSummary } = require('./vertex-ai');

// Create your server app
const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Store user data in memory
const userData = {};

// ============================================================
// ROUTES
// ============================================================

/**
 * GET /
 * Welcome page
 */
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Productivity Tracker API is running!',
        status: 'online',
        endpoints: [
            { path: '/', method: 'GET', description: 'This welcome page' },
            { path: '/health', method: 'GET', description: 'Server health check' },
            { path: '/api/activity', method: 'POST', description: 'Save activity data' },
            { path: '/api/activity/:userId/:date', method: 'GET', description: 'Get activity data' },
            { path: '/api/summarize', method: 'POST', description: 'Generate AI summary' }
        ]
    });
});

/**
 * GET /health
 * Health check
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
});

/**
 * POST /api/activity
 * Save user activity
 */
app.post('/api/activity', (req, res) => {
    const { userId, date, activityData } = req.body;
    
    console.log(`📊 Received activity for ${userId} on ${date}`);
    
    if (!userData[userId]) {
        userData[userId] = {};
    }
    userData[userId][date] = activityData;
    
    res.json({ 
        success: true, 
        message: 'Activity saved successfully!' 
    });
});

/**
 * GET /api/activity/:userId/:date
 * Get user activity
 */
app.get('/api/activity/:userId/:date', (req, res) => {
    const { userId, date } = req.params;
    
    const activity = userData[userId]?.[date] || null;
    
    res.json({ 
        success: true, 
        activity 
    });
});

/**
 * POST /api/summarize
 * Generate AI summary
 */
app.post('/api/summarize', async (req, res) => {
    const { userId, date } = req.body;
    
    console.log(`🤖 Generating summary for ${userId} on ${date}`);
    
    const activity = userData[userId]?.[date];
    if (!activity) {
        console.log(`⚠️ No activity found for ${userId} on ${date}`);
        return res.json({ 
            success: false, 
            message: 'No activity found for this date. Browse more websites first!' 
        });
    }
    
    // Check if there's enough data (at least 2 minutes total)
    const totalSeconds = Object.values(activity).reduce((a, b) => a + b, 0);
    if (totalSeconds < 120) {
        console.log(`⚠️ Not enough data: ${totalSeconds} seconds`);
        return res.json({ 
            success: false, 
            message: 'Not enough browsing data yet. Spend at least 2 minutes browsing!' 
        });
    }
    
    try {
        console.log(`📝 Sending ${Object.keys(activity).length} sites to AI...`);
        const summary = await generateSummary(activity);
        console.log(`✅ Summary generated successfully!`);
        res.json({ success: true, summary });
    } catch (error) {
        console.error('❌ Summary generation failed:', error.message);
        res.json({ 
            success: false, 
            error: 'Failed to generate summary',
            details: error.message 
        });
    }
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('🚀 PRODUCTIVITY TRACKER SERVER');
    console.log('='.repeat(50));
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log('='.repeat(50));
    console.log('Press Ctrl+C to stop the server');
    console.log('='.repeat(50));
});