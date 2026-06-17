// server.js - Complete backend with API key

const express = require('express');
const cors = require('cors');
const { generateSummary } = require('./vertex-ai');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// CORS CONFIGURATION
// ============================================================

const EXTENSION_ID = 'kfjpeiadkfkgjedmfojdepkbfbhdomod';

console.log(`🔗 CORS configured for: chrome-extension://${EXTENSION_ID}`);

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', `chrome-extension://${EXTENSION_ID}`);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(cors({
    origin: [
        `chrome-extension://${EXTENSION_ID}`,
        'http://localhost:3000',
        'http://localhost:3001'
    ]
}));

app.use(express.json());

// ============================================================
// Store user data in memory
// ============================================================

const userData = {};

// ============================================================
// ROUTES
// ============================================================

// Welcome page
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Productivity Tracker API is running!',
        status: 'online',
        endpoints: [
            { path: '/', method: 'GET', description: 'Welcome page' },
            { path: '/health', method: 'GET', description: 'Health check' },
            { path: '/api/activity', method: 'POST', description: 'Save activity' },
            { path: '/api/activity/:userId/:date', method: 'GET', description: 'Get activity' },
            { path: '/api/summarize', method: 'POST', description: 'Generate AI summary' }
        ]
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
});

// Save activity
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

// Get activity
app.get('/api/activity/:userId/:date', (req, res) => {
    const { userId, date } = req.params;
    
    const activity = userData[userId]?.[date] || null;
    
    res.json({ 
        success: true, 
        activity 
    });
});

// Generate AI summary
app.post('/api/summarize', async (req, res) => {
    const { userId, date } = req.body;
    
    console.log(`🤖 Generating summary for ${userId} on ${date}`);
    
    const activity = userData[userId]?.[date];
    if (!activity) {
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
        const summary = await generateSummary(activity, userId);
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
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📊 Health check: /health`);
    console.log(`🔗 CORS allowed for extension ID: ${EXTENSION_ID}`);
    console.log('='.repeat(50));
    console.log('Press Ctrl+C to stop the server');
    console.log('='.repeat(50));
});